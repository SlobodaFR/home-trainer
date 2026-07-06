import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class StartSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string, userId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'planned') {
      throw new ConflictException('Session is not in planned state');
    }
    return this.sessionRepository.updateStatus(sessionId, 'active');
  }
}
