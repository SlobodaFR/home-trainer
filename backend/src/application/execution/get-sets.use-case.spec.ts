import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { GetSetsUseCase } from './get-sets.use-case';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

const makeSession = (status: Session['status']): Session => ({
  id: 'session-1',
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: '2026-07-07',
  status,
  rpe: null,
  note: null,
  createdAt: new Date('2026-07-06'),
  exercises: [],
});

const mockLog: WorkoutLog = {
  id: 'log-1',
  sessionId: 'session-1',
  sessionExerciseId: 'se-1',
  userId: 'user-1',
  setNumber: 1,
  repsCompleted: 8,
  weightKg: 100,
  durationSeconds: null,
  completedAt: new Date('2026-07-07'),
};

describe('GetSetsUseCase', () => {
  let useCase: GetSetsUseCase;
  let sessionRepository: Mocked<SessionRepository>;
  let workoutLogRepository: Mocked<WorkoutLogRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetSetsUseCase,
        {
          provide: SessionRepository,
          useValue: { findById: vi.fn() },
        },
        {
          provide: WorkoutLogRepository,
          useValue: { findBySession: vi.fn() },
        },
      ],
    }).compile();

    useCase = module.get(GetSetsUseCase);
    sessionRepository = module.get(SessionRepository);
    workoutLogRepository = module.get(WorkoutLogRepository);
  });

  it('returns logs for valid session and user', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    workoutLogRepository.findBySession.mockResolvedValue([mockLog]);

    const result = await useCase.execute('session-1', 'user-1');

    expect(workoutLogRepository.findBySession).toHaveBeenCalledWith(
      'session-1',
    );
    expect(result).toEqual([mockLog]);
  });

  it('returns empty array when no sets logged', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('completed'));
    workoutLogRepository.findBySession.mockResolvedValue([]);

    const result = await useCase.execute('session-1', 'user-1');

    expect(result).toEqual([]);
  });

  it('throws NotFoundException when session not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('unknown', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when session belongs to different user', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    await expect(useCase.execute('session-1', 'user-99')).rejects.toThrow(
      NotFoundException,
    );
  });
});
