import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutionController } from './execution.controller';
import { FinishSessionUseCase } from '../../../application/execution/finish-session.use-case';
import { GetSetsUseCase } from '../../../application/execution/get-sets.use-case';
import { LogSetUseCase } from '../../../application/execution/log-set.use-case';
import { PauseSessionUseCase } from '../../../application/execution/pause-session.use-case';
import { ResumeSessionUseCase } from '../../../application/execution/resume-session.use-case';
import { StartSessionUseCase } from '../../../application/execution/start-session.use-case';
import { WorkoutLog } from '../../../domain/execution/workout-log';
import { Session } from '../../../domain/planning/session';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { FinishSessionDto } from '../dto/finish-session.dto';
import { LogSetDto } from '../dto/log-set.dto';

const mockUser: CurrentUserPayload = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
};

const mockSession: Session = {
  id: 'session-1',
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: '2026-07-07',
  status: 'active',
  rpe: null,
  note: null,
  createdAt: new Date('2026-07-06'),
  exercises: [],
};

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

describe('ExecutionController', () => {
  let controller: ExecutionController;
  let startSession: jest.Mocked<StartSessionUseCase>;
  let pauseSession: jest.Mocked<PauseSessionUseCase>;
  let resumeSession: jest.Mocked<ResumeSessionUseCase>;
  let finishSession: jest.Mocked<FinishSessionUseCase>;
  let logSet: jest.Mocked<LogSetUseCase>;
  let getSets: jest.Mocked<GetSetsUseCase>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [
        { provide: StartSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: PauseSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: ResumeSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: FinishSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: LogSetUseCase, useValue: { execute: jest.fn() } },
        { provide: GetSetsUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ExecutionController);
    startSession = module.get(StartSessionUseCase);
    pauseSession = module.get(PauseSessionUseCase);
    resumeSession = module.get(ResumeSessionUseCase);
    finishSession = module.get(FinishSessionUseCase);
    logSet = module.get(LogSetUseCase);
    getSets = module.get(GetSetsUseCase);
  });

  describe('startSession', () => {
    it('delegates to StartSessionUseCase with correct args', async () => {
      startSession.execute.mockResolvedValue(mockSession);
      const result = await controller.startSession('session-1', mockUser);
      expect(startSession.execute).toHaveBeenCalledWith('session-1', 'user-1');
      expect(result).toEqual(mockSession);
    });

    it('propagates ConflictException', async () => {
      startSession.execute.mockRejectedValue(
        new ConflictException('Session is not in planned state'),
      );
      await expect(
        controller.startSession('session-1', mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException', async () => {
      startSession.execute.mockRejectedValue(
        new NotFoundException('Session not found'),
      );
      await expect(
        controller.startSession('unknown', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('pauseSession', () => {
    it('delegates to PauseSessionUseCase with correct args', async () => {
      pauseSession.execute.mockResolvedValue(mockSession);
      const result = await controller.pauseSession('session-1', mockUser);
      expect(pauseSession.execute).toHaveBeenCalledWith('session-1', 'user-1');
      expect(result).toEqual(mockSession);
    });
  });

  describe('resumeSession', () => {
    it('delegates to ResumeSessionUseCase with correct args', async () => {
      resumeSession.execute.mockResolvedValue(mockSession);
      const result = await controller.resumeSession('session-1', mockUser);
      expect(resumeSession.execute).toHaveBeenCalledWith('session-1', 'user-1');
      expect(result).toEqual(mockSession);
    });
  });

  describe('finishSession', () => {
    it('delegates to FinishSessionUseCase with rpe and note', async () => {
      const completed = {
        ...mockSession,
        status: 'completed' as const,
        rpe: 8,
        note: 'Good',
      };
      finishSession.execute.mockResolvedValue(completed);
      const dto = Object.assign(new FinishSessionDto(), {
        rpe: 8,
        note: 'Good',
      });

      const result = await controller.finishSession('session-1', dto, mockUser);

      expect(finishSession.execute).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        8,
        'Good',
      );
      expect(result.status).toBe('completed');
    });

    it('passes null when rpe and note are absent', async () => {
      finishSession.execute.mockResolvedValue(mockSession);
      const dto = new FinishSessionDto();

      await controller.finishSession('session-1', dto, mockUser);

      expect(finishSession.execute).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        null,
        null,
      );
    });
  });

  describe('logSet', () => {
    it('delegates to LogSetUseCase with correct args', async () => {
      logSet.execute.mockResolvedValue(mockLog);
      const dto = Object.assign(new LogSetDto(), {
        sessionExerciseId: 'se-1',
        setNumber: 1,
        repsCompleted: 8,
        weightKg: 100,
      });

      const result = await controller.logSet('session-1', dto, mockUser);

      expect(logSet.execute).toHaveBeenCalledWith('session-1', 'user-1', {
        sessionExerciseId: 'se-1',
        setNumber: 1,
        repsCompleted: 8,
        weightKg: 100,
        durationSeconds: null,
      });
      expect(result).toEqual(mockLog);
    });
  });

  describe('getSets', () => {
    it('delegates to GetSetsUseCase with correct args', async () => {
      getSets.execute.mockResolvedValue([mockLog]);
      const result = await controller.getSets('session-1', mockUser);
      expect(getSets.execute).toHaveBeenCalledWith('session-1', 'user-1');
      expect(result).toEqual([mockLog]);
    });
  });
});
