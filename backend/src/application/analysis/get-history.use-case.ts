import { Injectable } from '@nestjs/common';
import { AnalysisStatus } from '../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

export interface HistoryEntry {
  session: Session;
  volumeKg: number;
  analysisStatus: AnalysisStatus | null;
}

@Injectable()
export class GetHistoryUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly workoutLogRepository: WorkoutLogRepository,
    private readonly analysisRepository: SessionAnalysisRepository,
  ) {}

  async execute(userId: string): Promise<HistoryEntry[]> {
    const allSessions = await this.sessionRepository.findByUser(userId, 'all');
    const completed = allSessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));

    return Promise.all(
      completed.map(async (session) => {
        const [logs, analysis] = await Promise.all([
          this.workoutLogRepository.findBySession(session.id),
          this.analysisRepository.findBySessionId(session.id),
        ]);

        let volumeKg = 0;
        for (const log of logs) {
          if (log.repsCompleted !== null && log.weightKg !== null) {
            volumeKg += log.repsCompleted * log.weightKg;
          } else if (log.repsCompleted !== null) {
            volumeKg += log.repsCompleted;
          }
        }

        return {
          session,
          volumeKg,
          analysisStatus: analysis ? analysis.status : null,
        };
      }),
    );
  }
}
