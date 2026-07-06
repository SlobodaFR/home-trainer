import { Session } from './session';

export interface NewSessionExercise {
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: number;
  repsOrDuration: string;
}

export interface NewSession {
  userId: string;
  goalId: string;
  plannedDate: string;
  exercises: NewSessionExercise[];
}

export abstract class SessionRepository {
  abstract findByUser(
    userId: string,
    statusFilter: 'upcoming' | 'all',
  ): Promise<Session[]>;
  abstract findById(id: string): Promise<Session | null>;
  abstract saveAll(sessions: NewSession[]): Promise<void>;
  abstract replaceExercises(
    sessionId: string,
    exercises: NewSessionExercise[],
  ): Promise<Session>;
  abstract updateStatus(
    id: string,
    status: Session['status'],
  ): Promise<Session>;
  abstract saveOutcome(
    id: string,
    rpe: number | null,
    note: string | null,
  ): Promise<Session>;
}
