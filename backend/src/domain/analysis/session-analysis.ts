export type AnalysisStatus = 'pending' | 'done' | 'failed';

export interface SessionAnalysis {
  id: string;
  sessionId: string;
  userId: string;
  status: AnalysisStatus;
  result: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}
