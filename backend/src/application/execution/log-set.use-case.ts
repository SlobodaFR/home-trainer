import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { SessionRepository } from '../../domain/planning/session.repository';

export interface LogSetInput {
  sessionExerciseId: string;
  setNumber: number;
  repsCompleted: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
}

@Injectable()
export class LogSetUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly workoutLogRepository: WorkoutLogRepository,
  ) {}

  async execute(
    sessionId: string,
    userId: string,
    data: LogSetInput,
  ): Promise<WorkoutLog> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'active') {
      throw new ConflictException('Session is not active');
    }
    const exercise = session.exercises.find(
      (e) => e.id === data.sessionExerciseId,
    );
    if (!exercise) {
      throw new NotFoundException('Session exercise not found');
    }
    return this.workoutLogRepository.save({
      sessionId,
      userId,
      sessionExerciseId: data.sessionExerciseId,
      setNumber: data.setNumber,
      repsCompleted: data.repsCompleted,
      weightKg: data.weightKg,
      durationSeconds: data.durationSeconds,
    });
  }
}
