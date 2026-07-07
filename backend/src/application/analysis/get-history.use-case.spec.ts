import { GetHistoryUseCase } from './get-history.use-case';
import { SessionAnalysis } from '../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

const makeSession = (
  id: string,
  status: Session['status'],
  plannedDate: string,
): Session => ({
  id,
  userId: 'u-1',
  goalId: 'g-1',
  plannedDate,
  status,
  rpe: null,
  note: null,
  createdAt: new Date('2026-01-01'),
  exercises: [],
});

const makeLog = (reps: number | null, weight: number | null): WorkoutLog => ({
  id: 'log-1',
  sessionId: 's-1',
  sessionExerciseId: 'se-1',
  userId: 'u-1',
  setNumber: 1,
  repsCompleted: reps,
  weightKg: weight,
  durationSeconds: null,
  completedAt: new Date('2026-01-01'),
});

const makeAnalysis = (
  sessionId: string,
  status: SessionAnalysis['status'],
): SessionAnalysis => ({
  id: 'a-1',
  sessionId,
  userId: 'u-1',
  status,
  result: null,
  retryCount: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

function makeDeps(overrides: {
  sessions?: Session[];
  logs?: WorkoutLog[];
  analysis?: SessionAnalysis | null;
}) {
  const sessionRepo = {
    findByUser: jest.fn().mockResolvedValue(overrides.sessions ?? []),
  } as unknown as jest.Mocked<SessionRepository>;

  const workoutLogRepo = {
    findBySession: jest.fn().mockResolvedValue(overrides.logs ?? []),
  } as unknown as jest.Mocked<WorkoutLogRepository>;

  const analysisRepo = {
    findBySessionId: jest.fn().mockResolvedValue(overrides.analysis ?? null),
  } as unknown as jest.Mocked<SessionAnalysisRepository>;

  return { sessionRepo, workoutLogRepo, analysisRepo };
}

describe('GetHistoryUseCase', () => {
  it('returns only completed sessions', async () => {
    const { sessionRepo, workoutLogRepo, analysisRepo } = makeDeps({
      sessions: [
        makeSession('s-1', 'completed', '2026-07-01'),
        makeSession('s-2', 'planned', '2026-07-02'),
        makeSession('s-3', 'active', '2026-07-03'),
      ],
    });
    const useCase = new GetHistoryUseCase(
      sessionRepo,
      workoutLogRepo,
      analysisRepo,
    );
    const result = await useCase.execute('u-1');
    expect(result).toHaveLength(1);
    expect(result[0].session.id).toBe('s-1');
  });

  it('sorts completed sessions newest first', async () => {
    const { sessionRepo, workoutLogRepo, analysisRepo } = makeDeps({
      sessions: [
        makeSession('s-1', 'completed', '2026-07-01'),
        makeSession('s-2', 'completed', '2026-07-05'),
        makeSession('s-3', 'completed', '2026-07-03'),
      ],
    });
    const useCase = new GetHistoryUseCase(
      sessionRepo,
      workoutLogRepo,
      analysisRepo,
    );
    const result = await useCase.execute('u-1');
    expect(result.map((e) => e.session.id)).toEqual(['s-2', 's-3', 's-1']);
  });

  it('computes volumeKg as sum of reps × weight', async () => {
    const { sessionRepo, workoutLogRepo, analysisRepo } = makeDeps({
      sessions: [makeSession('s-1', 'completed', '2026-07-01')],
      logs: [makeLog(10, 50), makeLog(8, 60)],
    });
    const useCase = new GetHistoryUseCase(
      sessionRepo,
      workoutLogRepo,
      analysisRepo,
    );
    const result = await useCase.execute('u-1');
    expect(result[0].volumeKg).toBe(980); // 10*50 + 8*60
  });

  it('uses repsCompleted as fallback when weightKg is null', async () => {
    const { sessionRepo, workoutLogRepo, analysisRepo } = makeDeps({
      sessions: [makeSession('s-1', 'completed', '2026-07-01')],
      logs: [makeLog(5, null)],
    });
    const useCase = new GetHistoryUseCase(
      sessionRepo,
      workoutLogRepo,
      analysisRepo,
    );
    const result = await useCase.execute('u-1');
    expect(result[0].volumeKg).toBe(5);
  });

  it('returns null analysisStatus when no analysis record exists', async () => {
    const { sessionRepo, workoutLogRepo, analysisRepo } = makeDeps({
      sessions: [makeSession('s-1', 'completed', '2026-07-01')],
      analysis: null,
    });
    const useCase = new GetHistoryUseCase(
      sessionRepo,
      workoutLogRepo,
      analysisRepo,
    );
    const result = await useCase.execute('u-1');
    expect(result[0].analysisStatus).toBeNull();
  });

  it('returns analysisStatus from analysis record', async () => {
    const { sessionRepo, workoutLogRepo, analysisRepo } = makeDeps({
      sessions: [makeSession('s-1', 'completed', '2026-07-01')],
      analysis: makeAnalysis('s-1', 'done'),
    });
    const useCase = new GetHistoryUseCase(
      sessionRepo,
      workoutLogRepo,
      analysisRepo,
    );
    const result = await useCase.execute('u-1');
    expect(result[0].analysisStatus).toBe('done');
  });
});
