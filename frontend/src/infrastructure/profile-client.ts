export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export interface FitnessProfileConfig {
  maxSetsPerExercise: number;
  intensityMultiplier: number;
}

export interface FitnessProfileDraft {
  level: FitnessLevel;
  injuryNotes: string;
  equipmentComfortList: string[];
  specificGoal: string;
  summary: string;
  plannerConfig: FitnessProfileConfig;
}

export interface UserFitnessProfile extends FitnessProfileDraft {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessInput {
  experience: 'débutant' | 'intermédiaire' | 'avancé';
  yearsTraining: number;
  injuries: string[];
  injuryNote: string;
  equipmentComfort: string[];
  specificGoal: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${String(res.status)}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function assessFitness(
  input: AssessInput,
): Promise<FitnessProfileDraft> {
  return request<FitnessProfileDraft>('/api/profile/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function saveProfile(
  draft: FitnessProfileDraft,
): Promise<UserFitnessProfile> {
  return request<UserFitnessProfile>('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
}

export function getProfile(): Promise<UserFitnessProfile | null> {
  return request<UserFitnessProfile>('/api/profile').catch((err: unknown) => {
    if (err instanceof Error && err.message.startsWith('404')) return null;
    throw err;
  });
}
