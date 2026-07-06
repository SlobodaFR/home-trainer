import type { Session } from './planning-client';

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

export interface WorkoutLog {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  userId: string;
  setNumber: number;
  repsCompleted: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  completedAt: string;
}

export interface LogSetInput {
  sessionExerciseId: string;
  setNumber: number;
  repsCompleted?: number;
  weightKg?: number;
  durationSeconds?: number;
}

export function startSession(id: string): Promise<Session> {
  return request<Session>(`${BASE_SESSIONS}/${id}/start`, { method: 'POST' });
}

export function pauseSession(id: string): Promise<Session> {
  return request<Session>(`${BASE_SESSIONS}/${id}/pause`, { method: 'POST' });
}

export function resumeSession(id: string): Promise<Session> {
  return request<Session>(`${BASE_SESSIONS}/${id}/resume`, { method: 'POST' });
}

export function finishSession(
  id: string,
  rpe: number | null,
  note: string | null,
): Promise<Session> {
  const body: Record<string, unknown> = {};
  if (rpe !== null) body.rpe = rpe;
  if (note !== null) body.note = note;
  return request<Session>(`${BASE_SESSIONS}/${id}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function logSet(
  sessionId: string,
  input: LogSetInput,
): Promise<WorkoutLog> {
  return request<WorkoutLog>(`${BASE_SESSIONS}/${sessionId}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getSets(sessionId: string): Promise<WorkoutLog[]> {
  return request<WorkoutLog[]>(`${BASE_SESSIONS}/${sessionId}/sets`);
}
