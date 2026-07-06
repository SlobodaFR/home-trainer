import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class ResumeSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string, userId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'paused') {
      throw new ConflictException('Session is not paused');
    }
    return this.sessionRepository.updateStatus(sessionId, 'active');
  }
}
