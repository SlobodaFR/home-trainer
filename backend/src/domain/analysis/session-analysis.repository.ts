import { SessionAnalysis } from './session-analysis';

export abstract class SessionAnalysisRepository {
  abstract findBySessionId(sessionId: string): Promise<SessionAnalysis | null>;
  abstract save(
    data: Omit<SessionAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SessionAnalysis>;
  abstract update(
    id: string,
    patch: Partial<Pick<SessionAnalysis, 'status' | 'result' | 'retryCount'>>,
  ): Promise<void>;
}
