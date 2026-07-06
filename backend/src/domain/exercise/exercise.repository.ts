import { Exercise } from './exercise';

export abstract class ExerciseRepository {
  abstract findAll(params: {
    muscleGroup?: string;
    equipment?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Exercise[]; total: number }>;

  abstract findById(id: string): Promise<Exercise | null>;
}
