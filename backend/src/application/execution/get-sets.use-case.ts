import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class GetSetsUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly workoutLogRepository: WorkoutLogRepository,
  ) {}

  async execute(sessionId: string, userId: string): Promise<WorkoutLog[]> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    return this.workoutLogRepository.findBySession(sessionId);
  }
}
