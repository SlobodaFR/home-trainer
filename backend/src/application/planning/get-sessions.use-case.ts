import { Injectable } from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class GetSessionsUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(
    userId: string,
    statusFilter: 'upcoming' | 'all',
  ): Promise<Session[]> {
    return this.sessionRepository.findByUser(userId, statusFilter);
  }
}
