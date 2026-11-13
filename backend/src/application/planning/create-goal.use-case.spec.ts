import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { CreateGoalUseCase } from './create-goal.use-case';
import { PlannerService } from './planner.service';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';
import { Goal } from '../../domain/planning/goal';
import { GoalRepository } from '../../domain/planning/goal.repository';
import {
  NewSession,
  SessionRepository,
} from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';

const mockGoal: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  type: 'strength',
  targetDescription: 'Get stronger',
  horizonWeeks: 4,
  availabilityDays: [1, 3, 5],
  sessionDurationMinutes: 60,
  availableEquipment: ['barbell'],
  activeFrom: '2026-07-06',
  isActive: true,
  createdAt: new Date('2026-07-06'),
};

describe('CreateGoalUseCase', () => {
  let useCase: CreateGoalUseCase;
  let goalRepository: Mocked<GoalRepository>;
  let sessionRepository: Mocked<SessionRepository>;
  let exerciseRepository: Mocked<ExerciseRepository>;
  let userExerciseRepository: Mocked<UserExerciseRepository>;
  let plannerService: Mocked<PlannerService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateGoalUseCase,
        {
          provide: GoalRepository,
          useValue: {
            deactivateAllForUser: vi.fn().mockResolvedValue(undefined),
            save: vi.fn().mockResolvedValue(mockGoal),
          },
        },
        {
          provide: SessionRepository,
          useValue: { saveAll: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ExerciseRepository,
          useValue: {
            findAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
          },
        },
        {
          provide: UserExerciseRepository,
          useValue: { findByUser: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: PlannerService,
          useValue: {
            generateSessions: vi.fn().mockReturnValue([] as NewSession[]),
          },
        },
        {
          provide: ProfileRepository,
          useValue: { findByUser: vi.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    useCase = module.get(CreateGoalUseCase);
    goalRepository = module.get(GoalRepository);
    sessionRepository = module.get(SessionRepository);
    exerciseRepository = module.get(ExerciseRepository);
    userExerciseRepository = module.get(UserExerciseRepository);
    plannerService = module.get(PlannerService);
  });

  it('deactivates previous goals before saving new one', async () => {
    const deactivateOrder: string[] = [];
    goalRepository.deactivateAllForUser.mockImplementation(() => {
      deactivateOrder.push('deactivate');
      return Promise.resolve();
    });
    goalRepository.save.mockImplementation(() => {
      deactivateOrder.push('save');
      return Promise.resolve(mockGoal);
    });

    await useCase.execute('user-1', {
      type: 'strength',
      targetDescription: 'Test',
      horizonWeeks: 4,
      availabilityDays: [1],
      sessionDurationMinutes: 60,
      availableEquipment: [],
      activeFrom: '2026-07-06',
    });

    expect(deactivateOrder).toEqual(['deactivate', 'save']);
  });

  it('returns the created goal', async () => {
    const result = await useCase.execute('user-1', {
      type: 'strength',
      targetDescription: 'Test',
      horizonWeeks: 4,
      availabilityDays: [1],
      sessionDurationMinutes: 60,
      availableEquipment: [],
      activeFrom: '2026-07-06',
    });
    expect(result).toEqual(mockGoal);
  });

  it('persists generated sessions', async () => {
    const generatedSessions: NewSession[] = [
      {
        userId: 'user-1',
        goalId: 'goal-1',
        plannedDate: '2026-07-06',
        exercises: [],
      },
    ];
    plannerService.generateSessions.mockReturnValue(generatedSessions);

    await useCase.execute('user-1', {
      type: 'strength',
      targetDescription: 'Test',
      horizonWeeks: 4,
      availabilityDays: [1],
      sessionDurationMinutes: 60,
      availableEquipment: [],
      activeFrom: '2026-07-06',
    });

    expect(sessionRepository.saveAll).toHaveBeenCalledWith(generatedSessions);
  });

  it('enriches exercises with user preference data before planning', async () => {
    exerciseRepository.findAll.mockResolvedValue({
      data: [
        {
          id: 'ex-1',
          wgerId: null,
          name: 'Push-up',
          description: '',
          muscleGroups: [],
          equipment: [],
          imageUrl: null,
          muscleImages: [],
          youtubeUrl: null,
          everkineticSlug: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    });
    userExerciseRepository.findByUser.mockResolvedValue([
      {
        userId: 'user-1',
        exerciseId: 'ex-1',
        isFavorite: true,
        preferenceWeight: 5,
      },
    ]);

    await useCase.execute('user-1', {
      type: 'strength',
      targetDescription: 'Test',
      horizonWeeks: 1,
      availabilityDays: [1],
      sessionDurationMinutes: 60,
      availableEquipment: [],
      activeFrom: '2026-07-06',
    });

    expect(plannerService.generateSessions).toHaveBeenCalledWith(
      mockGoal,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ex-1',
          isFavorite: true,
          preferenceWeight: 5,
        }),
      ]),
      undefined,
    );
  });
});
