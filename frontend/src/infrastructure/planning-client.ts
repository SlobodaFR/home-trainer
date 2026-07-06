export type GoalType = 'strength' | 'mobility' | 'endurance' | 'general';

export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  targetDescription: string;
  horizonWeeks: number;
  availabilityDays: number[];
  sessionDurationMinutes: number;
  availableEquipment: string[];
  activeFrom: string;
  isActive: boolean;
  createdAt: string;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: number;
  repsOrDuration: string;
}

export interface Session {
  id: string;
  userId: string;
  goalId: string;
  plannedDate: string;
  status: 'planned' | 'active' | 'paused' | 'completed';
  rpe: number | null;
  note: string | null;
  createdAt: string;
  exercises: SessionExercise[];
}

export interface CreateGoalInput {
  type: GoalType;
  targetDescription: string;
  horizonWeeks: number;
  availabilityDays: number[];
  sessionDurationMinutes: number;
  availableEquipment: string[];
  activeFrom?: string;
}

const BASE_GOALS = '/api/goals';
const BASE_SESSIONS = '/api/sessions';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${String(res.status)}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getActiveGoal(): Promise<Goal | null> {
  return request<Goal>(`${BASE_GOALS}/active`).catch((err: unknown) => {
    if (err instanceof Error && err.message.startsWith('404')) return null;
    throw err;
  });
}

export function createGoal(data: CreateGoalInput): Promise<Goal> {
  return request<Goal>(BASE_GOALS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function listSessions(): Promise<Session[]> {
  return request<Session[]>(BASE_SESSIONS);
}

export function getSession(id: string): Promise<Session> {
  return request<Session>(`${BASE_SESSIONS}/${id}`);
}

export function replanSession(id: string): Promise<Session> {
  return request<Session>(`${BASE_SESSIONS}/${id}/replan`, { method: 'POST' });
}
