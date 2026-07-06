import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlanningController } from './planning.controller';
import { CreateGoalUseCase } from '../../../application/planning/create-goal.use-case';
import { GetActiveGoalUseCase } from '../../../application/planning/get-active-goal.use-case';
import { GetSessionByIdUseCase } from '../../../application/planning/get-session-by-id.use-case';
import { GetSessionsUseCase } from '../../../application/planning/get-sessions.use-case';
import { ReplanSessionUseCase } from '../../../application/planning/replan-session.use-case';
import { Goal } from '../../../domain/planning/goal';
import { Session } from '../../../domain/planning/session';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { CreateGoalDto } from '../dto/create-goal.dto';

const mockUser: CurrentUserPayload = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
};

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

const mockSession: Session = {
  id: 'session-1',
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: '2026-07-07',
  status: 'planned',
  createdAt: new Date('2026-07-06'),
  exercises: [],
};

describe('PlanningController', () => {
  let controller: PlanningController;
  let createGoal: jest.Mocked<CreateGoalUseCase>;
  let getActiveGoal: jest.Mocked<GetActiveGoalUseCase>;
  let getSessions: jest.Mocked<GetSessionsUseCase>;
  let getSessionById: jest.Mocked<GetSessionByIdUseCase>;
  let replanSession: jest.Mocked<ReplanSessionUseCase>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlanningController],
      providers: [
        { provide: CreateGoalUseCase, useValue: { execute: jest.fn() } },
        { provide: GetActiveGoalUseCase, useValue: { execute: jest.fn() } },
        { provide: GetSessionsUseCase, useValue: { execute: jest.fn() } },
        { provide: GetSessionByIdUseCase, useValue: { execute: jest.fn() } },
        { provide: ReplanSessionUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PlanningController);
    createGoal = module.get(CreateGoalUseCase);
    getActiveGoal = module.get(GetActiveGoalUseCase);
    getSessions = module.get(GetSessionsUseCase);
    getSessionById = module.get(GetSessionByIdUseCase);
    replanSession = module.get(ReplanSessionUseCase);
  });

  describe('createGoal', () => {
    it('returns created goal', async () => {
      createGoal.execute.mockResolvedValue(mockGoal);
      const dto = Object.assign(new CreateGoalDto(), {
        type: 'strength',
        targetDescription: 'Get stronger',
        horizonWeeks: 4,
        availabilityDays: [1],
        sessionDurationMinutes: 60,
        availableEquipment: [],
        activeFrom: '2026-07-06',
      });
      const result = await controller.createGoal(dto, mockUser);
      expect(result).toEqual(mockGoal);
    });

    it('uses today as activeFrom when not provided in dto', async () => {
      createGoal.execute.mockResolvedValue(mockGoal);
      const dto = Object.assign(new CreateGoalDto(), {
        type: 'strength',
        targetDescription: 'Test',
        horizonWeeks: 4,
        availabilityDays: [1],
        sessionDurationMinutes: 60,
        availableEquipment: [],
      });
      await controller.createGoal(dto, mockUser);
      expect(createGoal.execute).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          activeFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      );
    });
  });

  describe('getActiveGoal', () => {
    it('returns goal when found', async () => {
      getActiveGoal.execute.mockResolvedValue(mockGoal);
      const result = await controller.getActiveGoal(mockUser);
      expect(result).toEqual(mockGoal);
    });

    it('throws NotFoundException when no active goal', async () => {
      getActiveGoal.execute.mockResolvedValue(null);
      await expect(controller.getActiveGoal(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSessions', () => {
    it('passes onlyPlanned=true when ?all is not "true"', async () => {
      getSessions.execute.mockResolvedValue([mockSession]);
      await controller.getSessions('', mockUser);
      expect(getSessions.execute).toHaveBeenCalledWith('user-1', true);
    });

    it('passes onlyPlanned=false when ?all=true', async () => {
      getSessions.execute.mockResolvedValue([mockSession]);
      await controller.getSessions('true', mockUser);
      expect(getSessions.execute).toHaveBeenCalledWith('user-1', false);
    });
  });

  describe('getSession', () => {
    it('returns session when found', async () => {
      getSessionById.execute.mockResolvedValue(mockSession);
      const result = await controller.getSession('session-1', mockUser);
      expect(result).toEqual(mockSession);
    });

    it('throws NotFoundException when session not found', async () => {
      getSessionById.execute.mockResolvedValue(null);
      await expect(controller.getSession('unknown', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('replanSession', () => {
    it('returns updated session', async () => {
      replanSession.execute.mockResolvedValue(mockSession);
      const result = await controller.replanSession('session-1', mockUser);
      expect(result).toEqual(mockSession);
    });

    it('propagates ConflictException from use case', async () => {
      replanSession.execute.mockRejectedValue(
        new ConflictException('Cannot replan a session that is not planned'),
      );
      await expect(
        controller.replanSession('session-1', mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });
});
