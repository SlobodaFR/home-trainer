export interface WorkoutLog {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  userId: string;
  setNumber: number;
  repsCompleted: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  completedAt: Date;
}
