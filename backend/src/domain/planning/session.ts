import { SessionExercise } from './session-exercise';

export interface Session {
  id: string;
  userId: string;
  goalId: string;
  plannedDate: string;
  status: 'planned' | 'active' | 'paused' | 'completed';
  rpe: number | null;
  note: string | null;
  createdAt: Date;
  exercises: SessionExercise[];
}
