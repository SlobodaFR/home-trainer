export interface UserExercise {
  userId: string;
  exerciseId: string;
  isFavorite: boolean;
  preferenceWeight: number | null;
}
