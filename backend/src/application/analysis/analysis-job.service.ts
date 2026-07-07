import { Injectable } from '@nestjs/common';
import { PromptBuilderService } from './prompt-builder.service';
import { LLMService } from '../../domain/analysis/llm.service';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { SessionRepository } from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';

@Injectable()
export class AnalysisJobService {
  constructor(
    private readonly analysisRepository: SessionAnalysisRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly goalRepository: GoalRepository,
    private readonly workoutLogRepository: WorkoutLogRepository,
    private readonly promptBuilder: PromptBuilderService,
    private readonly llmService: LLMService,
    private readonly profileRepository: ProfileRepository,
  ) {}

  run(sessionId: string, userId: string, locale: string): void {
    void this.execute(sessionId, userId, locale, 0);
  }

  private async execute(
    sessionId: string,
    userId: string,
    locale: string,
    attempt: number,
  ): Promise<void> {
    const existing = await this.analysisRepository.findBySessionId(sessionId);
    if (existing) return;

    const analysis = await this.analysisRepository.save({
      sessionId,
      userId,
      status: 'pending',
      result: null,
      retryCount: attempt,
    });

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
    } catch {
      if (attempt < 1) {
        await this.analysisRepository.update(analysis.id, {
          retryCount: attempt + 1,
        });
        await this.execute(sessionId, userId, locale, attempt + 1);
      } else {
        await this.analysisRepository.update(analysis.id, { status: 'failed' });
      }
    }
  }
}
