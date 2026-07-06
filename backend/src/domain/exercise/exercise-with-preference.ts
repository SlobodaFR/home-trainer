import { Exercise } from './exercise';

export interface ExerciseWithPreference extends Exercise {
  isFavorite: boolean;
  preferenceWeight: number | null;
}
