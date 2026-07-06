import { Test } from '@nestjs/testing';
import { GetActiveGoalUseCase } from './get-active-goal.use-case';
import { Goal } from '../../domain/planning/goal';
import { GoalRepository } from '../../domain/planning/goal.repository';

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

describe('GetActiveGoalUseCase', () => {
  let useCase: GetActiveGoalUseCase;
  let goalRepository: jest.Mocked<GoalRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetActiveGoalUseCase,
        {
          provide: GoalRepository,
          useValue: { findActiveByUser: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get(GetActiveGoalUseCase);
    goalRepository = module.get(GoalRepository);
  });

  it('returns null when no active goal exists', async () => {
    goalRepository.findActiveByUser.mockResolvedValue(null);
    const result = await useCase.execute('user-1');
    expect(result).toBeNull();
  });

  it('returns the active goal when one exists', async () => {
    goalRepository.findActiveByUser.mockResolvedValue(mockGoal);
    const result = await useCase.execute('user-1');
    expect(result).toEqual(mockGoal);
  });

  it('queries by the provided userId', async () => {
    goalRepository.findActiveByUser.mockResolvedValue(null);
    await useCase.execute('user-42');
    expect(goalRepository.findActiveByUser).toHaveBeenCalledWith('user-42');
  });
});
