import { Injectable } from '@nestjs/common';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class GetSessionByIdUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(id: string, userId: string): Promise<Session | null> {
    const session = await this.sessionRepository.findById(id);
    if (session?.userId !== userId) return null;
    return session;
  }
}
