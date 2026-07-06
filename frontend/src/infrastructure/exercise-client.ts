export interface ExerciseWithPreference {
  id: string;
  wgerId: number | null;
  name: string;
  description: string;
  muscleGroups: string[];
  equipment: string[];
  youtubeUrl: string | null;
  everkineticSlug: string | null;
  createdAt: string;
  isFavorite: boolean;
  preferenceWeight: number | null;
}

interface PaginatedExercises {
  data: ExerciseWithPreference[];
  total: number;
  page: number;
  limit: number;
}

const BASE = '/api/exercises';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${String(res.status)}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listExercises(params: {
  muscleGroup?: string;
  equipment?: string;
  page: number;
  limit: number;
}): Promise<PaginatedExercises> {
  const q = new URLSearchParams();
  if (params.muscleGroup) q.set('muscleGroup', params.muscleGroup);
  if (params.equipment) q.set('equipment', params.equipment);
  q.set('page', String(params.page));
  q.set('limit', String(params.limit));
  return request<PaginatedExercises>(`${BASE}?${q.toString()}`);
}

export function getExercise(id: string): Promise<ExerciseWithPreference> {
  return request<ExerciseWithPreference>(`${BASE}/${id}`);
}

export function toggleFavorite(id: string): Promise<{ isFavorite: boolean }> {
  return request<{ isFavorite: boolean }>(`${BASE}/${id}/favorite`, {
    method: 'POST',
  });
}

export function removeFavorite(id: string): Promise<undefined> {
  return request<undefined>(`${BASE}/${id}/favorite`, { method: 'DELETE' });
}

export function setPreference(id: string, weight: number): Promise<undefined> {
  return request<undefined>(`${BASE}/${id}/preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight }),
  });
}
