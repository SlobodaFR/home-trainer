import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlannerService } from './planner.service';
import { ReplanSessionUseCase } from './replan-session.use-case';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';
import { Goal } from '../../domain/planning/goal';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';

const mockGoal: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  type: 'strength',
  targetDescription: 'Get stronger',
  horizonWeeks: 4,
  availabilityDays: [1],
  sessionDurationMinutes: 60,
  availableEquipment: [],
  activeFrom: '2026-07-06',
  isActive: true,
  createdAt: new Date('2026-07-06'),
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
  exercises: [],
});

describe('ReplanSessionUseCase', () => {
  let useCase: ReplanSessionUseCase;
  let sessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReplanSessionUseCase,
        {
          provide: SessionRepository,
          useValue: {
            findById: jest.fn(),
            replaceExercises: jest.fn(),
          },
        },
        {
          provide: GoalRepository,
          useValue: { findActiveByUser: jest.fn().mockResolvedValue(mockGoal) },
        },
        {
          provide: ExerciseRepository,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
          },
        },
        {
          provide: UserExerciseRepository,
          useValue: { findByUser: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: PlannerService,
          useValue: { buildSessionExercises: jest.fn().mockReturnValue([]) },
        },
        {
          provide: ProfileRepository,
          useValue: { findByUser: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    useCase = module.get(ReplanSessionUseCase);
    sessionRepository = module.get(SessionRepository);
  });

  it('replaces exercises and returns updated session for a planned session', async () => {
    const updatedSession = { ...makeSession('planned'), exercises: [] };
    sessionRepository.findById.mockResolvedValue(makeSession('planned'));
    sessionRepository.replaceExercises.mockResolvedValue(updatedSession);

    const result = await useCase.execute('session-1', 'user-1');

    expect(sessionRepository.replaceExercises).toHaveBeenCalledWith(
      'session-1',
      [],
    );
    expect(result).toEqual(updatedSession);
  });

  it('throws NotFoundException when session not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('unknown', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when session belongs to different user', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('planned'));
    await expect(useCase.execute('session-1', 'user-99')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ConflictException when session is active', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    await expect(useCase.execute('session-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException when session is completed', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('completed'));
    await expect(useCase.execute('session-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
