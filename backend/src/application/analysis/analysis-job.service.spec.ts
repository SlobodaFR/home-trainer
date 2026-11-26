import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { pseudonymize } from '../../domain/shared/pseudonymize';

const PSEUDONYM_SECRET = 'p'.repeat(48);

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
    new ConfigService({ PSEUDONYM_SECRET }),
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

function statefulRepoFor() {
  const rows = new Map<string, SessionAnalysis>();
  return {
    repo: {
      rows,
      findBySessionId: vi.fn((id: string) =>
        Promise.resolve(rows.get(id) ?? null),
      ),
      save: vi.fn((data: Omit<SessionAnalysis, 'id'>) => {
        const row = {
          ...data,
          id: 'a-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(row.sessionId, row);
        return Promise.resolve(row);
      }),
      update: vi.fn((id: string, patch: Partial<SessionAnalysis>) => {
        for (const row of rows.values()) {
          if (row.id === id) Object.assign(row, patch);
        }
        return Promise.resolve();
      }),
    },
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

  it('does not create a second row when one already exists for the session', async () => {
    const { service, analysisRepo } = makeDeps({
      analysisRepo: {
        findBySessionId: vi.fn().mockResolvedValue(mockAnalysis),
      },
    });
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(analysisRepo.save).not.toHaveBeenCalled();
  });

  it('logs each failed attempt without personal data or secrets', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service } = makeDeps({
      llm: {
        complete: vi
          .fn()
          .mockRejectedValue(
            new Error(
              'Incorrect API key sk-proj-****WXYZ for alice@example.com',
            ),
          ),
      },
    });

    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 100));

    expect(warn).toHaveBeenCalledTimes(2);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain(pseudonymize('u-1', PSEUDONYM_SECRET));
    expect(logged).toContain('Error');
    expect(logged).not.toContain('u-1');
    expect(logged).not.toContain('sk-');
    expect(logged).not.toContain('alice@example.com');
    warn.mockRestore();
  });

  it.each(['findBySessionId', 'save'])(
    'logs one sanitized warning and leaks no unhandled rejection when %s rejects',
    async (method) => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      const { service } = makeDeps({
        analysisRepo: {
          [method]: vi
            .fn()
            .mockRejectedValue(new Error('SQLITE_BUSY alice@example.com')),
        },
      });

      service.run('s-1', 'u-1', 'fr');
      await new Promise((r) => setTimeout(r, 100));
      process.off('unhandledRejection', unhandled);

      expect(unhandled).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).not.toContain('alice@example.com');
      expect(logged).not.toContain('u-1');
      warn.mockRestore();
    },
  );

  it('marks the analysis failed when an unexpected error escapes after it was created', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(undefined);
    const { service } = makeDeps({
      analysisRepo: { update },
      llm: { complete: vi.fn().mockRejectedValue(new Error('LLM down')) },
    });

    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 100));

    expect(update).toHaveBeenCalledWith('a-1', { status: 'failed' });
    warn.mockRestore();
  });

  describe('with a stateful repository (real findBySessionId semantics)', () => {
    function statefulRepo(initial: SessionAnalysis[] = []) {
      const rows = new Map<string, SessionAnalysis>(
        initial.map((r) => [r.sessionId, { ...r }]),
      );
      return {
        rows,
        repo: {
          findBySessionId: vi.fn((sessionId: string) =>
            Promise.resolve(rows.get(sessionId) ?? null),
          ),
          save: vi.fn((data: Omit<SessionAnalysis, 'id'>) => {
            const row = {
              ...data,
              id: 'a-1',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            rows.set(row.sessionId, row);
            return Promise.resolve(row);
          }),
          update: vi.fn((id: string, patch: Partial<SessionAnalysis>) => {
            for (const row of rows.values()) {
              if (row.id === id) Object.assign(row, patch);
            }
            return Promise.resolve();
          }),
        },
      };
    }

    it('retries after a first failure and ends failed after the second', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const { rows, repo } = statefulRepo();
      const complete = vi.fn().mockRejectedValue(new Error('LLM down'));
      const { service } = makeDeps({
        analysisRepo: repo,
        llm: { complete },
      });
      service.run('s-1', 'u-1', 'fr');
      await new Promise((r) => setTimeout(r, 100));
      expect(complete).toHaveBeenCalledTimes(2);
      expect(rows.get('s-1')?.status).toBe('failed');
      warn.mockRestore();
    });

    it('succeeds on the second attempt after a first failure', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const { rows, repo } = statefulRepo();
      const complete = vi
        .fn()
        .mockRejectedValueOnce(new Error('LLM down'))
        .mockResolvedValue('Retried ok');
      const { service } = makeDeps({
        analysisRepo: repo,
        llm: { complete },
      });
      service.run('s-1', 'u-1', 'fr');
      await new Promise((r) => setTimeout(r, 100));
      expect(rows.get('s-1')?.status).toBe('done');
      expect(rows.get('s-1')?.result).toBe('Retried ok');
      expect(repo.save).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('picks up an analysis left pending (retry or crash) instead of skipping it', async () => {
      const { rows, repo } = statefulRepo([{ ...mockAnalysis, retryCount: 1 }]);
      const { service } = makeDeps({ analysisRepo: repo });
      service.run('s-1', 'u-1', 'fr');
      await new Promise((r) => setTimeout(r, 50));
      expect(repo.save).not.toHaveBeenCalled();
      expect(rows.get('s-1')?.status).toBe('done');
    });

    it.each(['done', 'failed'] as const)(
      'leaves a %s analysis alone',
      async (status) => {
        const { rows, repo } = statefulRepo([{ ...mockAnalysis, status }]);
        const { service, llm } = makeDeps({ analysisRepo: repo });
        service.run('s-1', 'u-1', 'fr');
        await new Promise((r) => setTimeout(r, 50));
        expect(llm.complete).not.toHaveBeenCalled();
        expect(rows.get('s-1')?.status).toBe(status);
      },
    );

    it('does not run the same session twice concurrently', async () => {
      const { repo } = statefulRepo();
      const { service, llm } = makeDeps({ analysisRepo: repo });
      service.run('s-1', 'u-1', 'fr');
      service.run('s-1', 'u-1', 'fr');
      await new Promise((r) => setTimeout(r, 100));
      expect(llm.complete).toHaveBeenCalledTimes(1);
    });
  });

  it('marks the analysis failed when the session is gone', async () => {
    const { service, analysisRepo, sessionRepo, llm } = makeDeps();
    sessionRepo.findById.mockResolvedValue(null);
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(analysisRepo.update).toHaveBeenCalledWith('a-1', {
      status: 'failed',
    });
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('marks the analysis failed when the goal is gone', async () => {
    const { service, analysisRepo, goalRepo, llm } = makeDeps();
    goalRepo.findActiveByUser.mockResolvedValue(null);
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(analysisRepo.update).toHaveBeenCalledWith('a-1', {
      status: 'failed',
    });
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('releases inFlight after success so the session can be re-run', async () => {
    const { repo } = statefulRepoFor();
    const { service, llm } = makeDeps({ analysisRepo: repo });
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    repo.rows.clear();
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(llm.complete).toHaveBeenCalledTimes(2);
  });

  it('releases inFlight after a failure so the session can be re-run', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { repo } = statefulRepoFor();
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue('ok');
    const { service } = makeDeps({ analysisRepo: repo, llm: { complete } });
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    repo.rows.clear();
    service.run('s-1', 'u-1', 'fr');
    await new Promise((r) => setTimeout(r, 50));
    expect(complete).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  describe('recoverPending', () => {
    it('recovers pending analyses one at a time, never in parallel', async () => {
      const second = { ...mockAnalysis, id: 'a-2', sessionId: 's-2' };
      let active = 0;
      let maxActive = 0;
      const complete = vi.fn().mockImplementation(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return 'ok';
      });
      const { service } = makeDeps({
        analysisRepo: {
          findPending: vi.fn().mockResolvedValue([mockAnalysis, second]),
          findBySessionId: vi.fn((id: string) =>
            Promise.resolve(id === 's-1' ? mockAnalysis : second),
          ),
        },
        llm: { complete },
      });
      await service.recoverPending();
      await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
      expect(maxActive).toBe(1);
    });

    it('returns without waiting for the LLM calls (boot is not blocked)', async () => {
      const complete = vi.fn().mockReturnValue(new Promise(() => undefined));
      const { service } = makeDeps({
        analysisRepo: {
          findPending: vi.fn().mockResolvedValue([mockAnalysis]),
          findBySessionId: vi.fn().mockResolvedValue(mockAnalysis),
        },
        llm: { complete },
      });
      await expect(service.recoverPending()).resolves.toBeUndefined();
    });

    it('re-runs every analysis found pending at boot', async () => {
      const { service, analysisRepo, llm } = makeDeps({
        analysisRepo: {
          findPending: vi.fn().mockResolvedValue([mockAnalysis]),
          findBySessionId: vi.fn().mockResolvedValue(mockAnalysis),
        },
      });
      await service.recoverPending();
      await new Promise((r) => setTimeout(r, 50));
      expect(analysisRepo.findPending).toHaveBeenCalled();
      expect(llm.complete).toHaveBeenCalledTimes(1);
      expect(analysisRepo.update).toHaveBeenCalledWith('a-1', {
        status: 'done',
        result: 'Great session!',
      });
    });

    it.each([
      [1, 'Recovering 1 pending analysis'],
      [2, 'Recovering 2 pending analyses'],
    ])('logs the plural correctly for %i orphan(s)', async (count, message) => {
      const log = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const { service } = makeDeps({
        analysisRepo: {
          findPending: vi
            .fn()
            .mockResolvedValue(
              Array.from({ length: count }, () => mockAnalysis),
            ),
          findBySessionId: vi.fn().mockResolvedValue(mockAnalysis),
        },
      });
      await service.recoverPending();
      expect(log).toHaveBeenCalledWith(message);
      log.mockRestore();
    });

    it('never throws when the lookup fails', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const { service } = makeDeps({
        analysisRepo: {
          findPending: vi.fn().mockRejectedValue(new Error('db down')),
        },
      });
      await expect(service.recoverPending()).resolves.toBeUndefined();
      warn.mockRestore();
    });
  });
});
