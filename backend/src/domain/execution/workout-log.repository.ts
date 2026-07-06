import { WorkoutLog } from './workout-log';

export abstract class WorkoutLogRepository {
  abstract findBySession(sessionId: string): Promise<WorkoutLog[]>;
  abstract save(
    data: Omit<WorkoutLog, 'id' | 'completedAt'>,
  ): Promise<WorkoutLog>;
}
