import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';
import { AnalysisJobService } from '../analysis/analysis-job.service';

@Injectable()
export class FinishSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly analysisJobService: AnalysisJobService,
  ) {}

  async execute(
    sessionId: string,
    userId: string,
    rpe: number | null,
    note: string | null,
    locale: string,
  ): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'active' && session.status !== 'paused') {
      throw new ConflictException('Session is not active or paused');
    }
    await this.sessionRepository.saveOutcome(sessionId, rpe, note);
    const completed = await this.sessionRepository.updateStatus(
      sessionId,
      'completed',
    );
    this.analysisJobService.run(sessionId, userId, locale);
    return completed;
  }
}
