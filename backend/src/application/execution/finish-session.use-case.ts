import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class FinishSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(
    sessionId: string,
    userId: string,
    rpe: number | null,
    note: string | null,
  ): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'active' && session.status !== 'paused') {
      throw new ConflictException('Session is not active or paused');
    }
    await this.sessionRepository.saveOutcome(sessionId, rpe, note);
    return this.sessionRepository.updateStatus(sessionId, 'completed');
  }
}
