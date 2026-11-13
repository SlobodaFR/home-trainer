import type { Mocked } from 'vitest';
import { AnalysisJobService } from './analysis-job.service';
import { PromptBuilderService } from './prompt-builder.service';
import { LLMService } from '../../domain/analysis/llm.service';
import { SessionAnalysis } from '../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { SessionRepository } from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';

const mockAnalysis: SessionAnalysis = {
  id: 'a-1',
  sessionId: 's-1',
  userId: 'u-1',
  status: 'pending',
  result: null,
  retryCount: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockSession = {
  id: 's-1',
  userId: 'u-1',
  goalId: 'g-1',
  plannedDate: '2026-07-07',
  status: 'completed' as const,
  rpe: 7,
  note: null,
  createdAt: new Date('2026-01-01'),
  exercises: [],
};

const mockGoal = {
  id: 'g-1',
  userId: 'u-1',
  type: 'strength' as const,
  targetDescription: 'Build strength',
  horizonWeeks: 8,
  availabilityDays: [1, 3],
  sessionDurationMinutes: 45,
  availableEquipment: [],
  activeFrom: '2026-01-01',
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

function makeDeps(
  overrides: Partial<{
    analysisRepo: Partial<SessionAnalysisRepository>;
    llm: Partial<LLMService>;
  }> = {},
) {
  const analysisRepo = {
    findBySessionId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(mockAnalysis),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides.analysisRepo,
  } as unknown as Mocked<SessionAnalysisRepository>;

  const sessionRepo = {
    findById: vi.fn().mockResolvedValue(mockSession),
    findByUser: vi.fn().mockResolvedValue([mockSession]),
  } as unknown as Mocked<SessionRepository>;

  const goalRepo = {
    findActiveByUser: vi.fn().mockResolvedValue(mockGoal),
  } as unknown as Mocked<GoalRepository>;

  const workoutLogRepo = {
    findBySession: vi.fn().mockResolvedValue([]),
  } as unknown as Mocked<WorkoutLogRepository>;

  const promptBuilder = {
    build: vi.fn().mockReturnValue({ systemPrompt: 'sys', userPrompt: 'user' }),
  } as unknown as Mocked<PromptBuilderService>;

  const llm = {
    complete: vi.fn().mockResolvedValue('Great session!'),
    ...overrides.llm,
  } as unknown as Mocked<LLMService>;

  const profileRepo = {
    findByUser: vi.fn().mockResolvedValue(null),
  } as unknown as Mocked<ProfileRepository>;

  const service = new AnalysisJobService(
    analysisRepo,
    sessionRepo,
    goalRepo,
    workoutLogRepo,
    promptBuilder,
    llm,
    profileRepo,
  );

  return {
    service,
    analysisRepo,
    sessionRepo,
    goalRepo,
    workoutLogRepo,
    promptBuilder,
    llm,
  };
}

describe('AnalysisJobService', () => {
  it('run() returns void immediately without awaiting', () => {
    const { service } = makeDeps();
    expect(service.run('s-1', 'u-1', 'fr')).toBeUndefined();
  });

  it('on LLM success, updates status to done with result', async () => {
    const { service, analysisRepo } = makeDeps();
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(analysisRepo.update).toHaveBeenCalledWith('a-1', {
      status: 'done',
      result: 'Great session!',
    });
  });

  it('on first LLM failure, retries once', async () => {
    let calls = 0;
    const { service } = makeDeps({
      llm: {
        complete: vi.fn().mockImplementation(() => {
          calls++;
          throw new Error('LLM down');
        }),
      },
    });
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toBe(2);
  });

  it('on two LLM failures, sets status to failed', async () => {
    const { service, analysisRepo } = makeDeps({
      llm: {
        complete: vi.fn().mockRejectedValue(new Error('LLM down')),
      },
    });
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 100));
    expect(analysisRepo.update).toHaveBeenCalledWith('a-1', {
      status: 'failed',
    });
  });

  it('skips if analysis already exists for sessionId', async () => {
    const { service, analysisRepo } = makeDeps({
      analysisRepo: {
        findBySessionId: vi.fn().mockResolvedValue(mockAnalysis),
      },
    });
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(analysisRepo.save).not.toHaveBeenCalled();
  });
});
