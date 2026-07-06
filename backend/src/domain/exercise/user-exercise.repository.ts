import { UserExercise } from './user-exercise';

export abstract class UserExerciseRepository {
  abstract findByUser(userId: string): Promise<UserExercise[]>;
  abstract findByUserAndExercise(
    userId: string,
    exerciseId: string,
  ): Promise<UserExercise | null>;
  abstract upsertFavorite(
    userId: string,
    exerciseId: string,
    isFavorite: boolean,
  ): Promise<void>;
  abstract upsertPreference(
    userId: string,
    exerciseId: string,
    weight: number,
  ): Promise<void>;
}
