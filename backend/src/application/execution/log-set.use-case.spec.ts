import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LogSetUseCase } from './log-set.use-case';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { WorkoutLogRepository } from '../../domain/execution/workout-log.repository';
import { Session } from '../../domain/planning/session';
import { SessionExercise } from '../../domain/planning/session-exercise';
import { SessionRepository } from '../../domain/planning/session.repository';

const mockExercise: SessionExercise = {
  id: 'se-1',
  sessionId: 'session-1',
  exerciseId: 'ex-1',
  exerciseName: 'Squat',
  order: 1,
  sets: 3,
  repsOrDuration: '8',
};

const makeSession = (status: Session['status']): Session => ({
  id: 'session-1',
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: '2026-07-07',
  status,
  rpe: null,
  note: null,
  createdAt: new Date('2026-07-06'),
  exercises: [mockExercise],
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

describe('LogSetUseCase', () => {
  let useCase: LogSetUseCase;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let workoutLogRepository: jest.Mocked<WorkoutLogRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LogSetUseCase,
        {
          provide: SessionRepository,
          useValue: { findById: jest.fn() },
        },
        {
          provide: WorkoutLogRepository,
          useValue: { save: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get(LogSetUseCase);
    sessionRepository = module.get(SessionRepository);
    workoutLogRepository = module.get(WorkoutLogRepository);
  });

  it('creates workout log for active session with valid exercise', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    workoutLogRepository.save.mockResolvedValue(mockLog);

    const result = await useCase.execute('session-1', 'user-1', {
      sessionExerciseId: 'se-1',
      setNumber: 1,
      repsCompleted: 8,
      weightKg: 100,
      durationSeconds: null,
    });

    expect(workoutLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        sessionExerciseId: 'se-1',
        setNumber: 1,
      }),
    );
    expect(result).toEqual(mockLog);
  });

  it('throws ConflictException when session is not active', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('paused'));
    await expect(
      useCase.execute('session-1', 'user-1', {
        sessionExerciseId: 'se-1',
        setNumber: 1,
        repsCompleted: 8,
        weightKg: null,
        durationSeconds: null,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when sessionExerciseId not in session', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    await expect(
      useCase.execute('session-1', 'user-1', {
        sessionExerciseId: 'se-unknown',
        setNumber: 1,
        repsCompleted: 8,
        weightKg: null,
        durationSeconds: null,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when session not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('unknown', 'user-1', {
        sessionExerciseId: 'se-1',
        setNumber: 1,
        repsCompleted: 8,
        weightKg: null,
        durationSeconds: null,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when session belongs to different user', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    await expect(
      useCase.execute('session-1', 'user-99', {
        sessionExerciseId: 'se-1',
        setNumber: 1,
        repsCompleted: 8,
        weightKg: null,
        durationSeconds: null,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
