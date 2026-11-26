import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptBuilderService } from './prompt-builder.service';
import { LLMService } from '../../domain/analysis/llm.service';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { SessionRepository } from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import { sanitizeErrorText } from '../../domain/shared/sanitize-error-text';

const DEFAULT_LOCALE = 'fr';

/** Tracks progress so an escaped error can be logged and the analysis marked failed. */
interface JobState {
  analysisId?: string;
  attempt?: number;
}

@Injectable()
export class AnalysisJobService {
  private readonly logger = new Logger(AnalysisJobService.name);
  /** Sessions with a job running in this process: a second run() must not duplicate the LLM call. */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly analysisRepository: SessionAnalysisRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly goalRepository: GoalRepository,
    private readonly workoutLogRepository: WorkoutLogRepository,
    private readonly promptBuilder: PromptBuilderService,
    private readonly llmService: LLMService,
    private readonly profileRepository: ProfileRepository,
    private readonly config: ConfigService,
  ) {}

  run(sessionId: string, userId: string, locale: string): void {
    if (this.inFlight.has(sessionId)) return;
    this.inFlight.add(sessionId);
    const state: JobState = {};
    this.execute(sessionId, userId, locale, 0, state)
      .catch((error: unknown) => {
        this.logFailure(sessionId, userId, state.attempt ?? 0, error);
        void this.markFailed(state.analysisId);
      })
      .finally(() => this.inFlight.delete(sessionId));
  }

  /**
   * Nothing runs yet when the process boots, so any analysis still pending was orphaned
   * (crash, deploy mid-job, or the former retry that never ran). Never throws.
   */
  async recoverPending(): Promise<void> {
    try {
      const pending = await this.analysisRepository.findPending();
      for (const analysis of pending) {
        this.run(analysis.sessionId, analysis.userId, DEFAULT_LOCALE);
      }
      if (pending.length > 0) {
        this.logger.log(`Recovered ${String(pending.length)} pending analysis`);
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? `${error.constructor.name}: ${sanitizeErrorText(error.message)}`
          : 'non-error thrown';
      this.logger.warn(`Pending analysis recovery failed: ${reason}`);
    }
  }

  /** Best effort: the caller is already handling a failure, this must never reject. */
  private async markFailed(analysisId: string | undefined): Promise<void> {
    if (!analysisId) return;
    try {
      await this.analysisRepository.update(analysisId, { status: 'failed' });
    } catch {
      // The database is the likely culprit: nothing more to do than the warning already logged.
    }
  }

  private async execute(
    sessionId: string,
    userId: string,
    locale: string,
    attempt: number,
    state: JobState,
  ): Promise<void> {
    state.attempt = attempt;
    const existing = await this.analysisRepository.findBySessionId(sessionId);
    // done/failed are final here (a manual retry flips the row back to pending first);
    // a pending row is ours to (re)run: the recursive retry, a manual retry or an orphan.
    if (existing && existing.status !== 'pending') return;

    const analysis = existing
      ? { ...existing, retryCount: attempt }
      : await this.analysisRepository.save({
          sessionId,
          userId,
          status: 'pending',
          result: null,
          retryCount: attempt,
        });
    if (existing && existing.retryCount !== attempt) {
      await this.analysisRepository.update(existing.id, {
        retryCount: attempt,
      });
    }
    state.analysisId = analysis.id;

    try {
      const [currentSession, allSessions, goal, profile] = await Promise.all([
        this.sessionRepository.findById(sessionId),
        this.sessionRepository.findByUser(userId, 'all'),
        this.goalRepository.findActiveByUser(userId),
        this.profileRepository.findByUser(userId),
      ]);

      if (!currentSession || !goal) {
        await this.analysisRepository.update(analysis.id, { status: 'failed' });
        return;
      }

      const history = allSessions
        .filter((s) => s.id !== sessionId && s.status === 'completed')
        .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))
        .slice(0, 5);

      const sessionIds = [currentSession.id, ...history.map((s) => s.id)];
      const allLogs = await Promise.all(
        sessionIds.map((id) => this.workoutLogRepository.findBySession(id)),
      );
      const logsBySession = new Map(
        sessionIds.map((id, i) => [id, allLogs[i] ?? []]),
      );

      const { systemPrompt, userPrompt } = this.promptBuilder.build({
        currentSession,
        history,
        logsBySession,
        goal,
        locale,
        profile: profile ?? undefined,
      });

      const result = await this.llmService.complete(systemPrompt, userPrompt);
      await this.analysisRepository.update(analysis.id, {
        status: 'done',
        result,
      });
    } catch (error) {
      this.logFailure(sessionId, userId, attempt, error);
      if (attempt < 1) {
        await this.analysisRepository.update(analysis.id, {
          retryCount: attempt + 1,
        });
        await this.execute(sessionId, userId, locale, attempt + 1, state);
      } else {
        await this.analysisRepository.update(analysis.id, { status: 'failed' });
      }
    }
  }

  /** Pseudonymized user, sanitized error: neither personal data nor upstream bodies in logs. */
  private logFailure(
    sessionId: string,
    userId: string,
    attempt: number,
    error: unknown,
  ): void {
    const user = pseudonymize(
      userId,
      this.config.getOrThrow<string>('PSEUDONYM_SECRET'),
    );
    const reason =
      error instanceof Error
        ? `${error.constructor.name}: ${sanitizeErrorText(error.message)}`
        : 'non-error thrown';
    this.logger.warn(
      `Analysis attempt ${String(attempt + 1)} failed for session ${sessionId} (user ${user}): ${reason}`,
    );
  }
}
