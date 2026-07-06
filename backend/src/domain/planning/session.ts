import { SessionExercise } from './session-exercise';

export interface Session {
  id: string;
  userId: string;
  goalId: string;
  plannedDate: string;
  status: 'planned' | 'active' | 'completed';
  createdAt: Date;
  exercises: SessionExercise[];
}
