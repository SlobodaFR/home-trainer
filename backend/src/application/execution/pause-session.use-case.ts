import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class PauseSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string, userId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'active') {
      throw new ConflictException('Session is not active');
    }
    return this.sessionRepository.updateStatus(sessionId, 'paused');
  }
}
