import type { Session } from './planning-client';

export type AnalysisStatus = 'pending' | 'done' | 'failed';

export interface SessionAnalysis {
  id: string;
  sessionId: string;
  userId: string;
  status: AnalysisStatus;
  result: string | null;
}

export interface HistoryEntry {
  session: Session;
  volumeKg: number;
  analysisStatus: AnalysisStatus | null;
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

export function getAnalysis(
  sessionId: string,
): Promise<SessionAnalysis | null> {
  return request<SessionAnalysis>(`/api/analyses/${sessionId}`).catch(
    (err: unknown) => {
      if (err instanceof Error && err.message.startsWith('404')) return null;
      throw err;
    },
  );
}

export function retryAnalysis(sessionId: string): Promise<void> {
  return request<undefined>(`/api/analyses/${sessionId}/retry`, {
    method: 'POST',
  });
}

export function getHistory(): Promise<HistoryEntry[]> {
  return request<HistoryEntry[]>('/api/history');
}
