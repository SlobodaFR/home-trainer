import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FinishSessionUseCase } from './finish-session.use-case';
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

describe('FinishSessionUseCase', () => {
  let useCase: FinishSessionUseCase;
  let sessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FinishSessionUseCase,
        {
          provide: SessionRepository,
          useValue: {
            findById: jest.fn(),
            saveOutcome: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(FinishSessionUseCase);
    sessionRepository = module.get(SessionRepository);
  });

  it('saves outcome and transitions active session to completed', async () => {
    const completed = {
      ...makeSession('completed'),
      rpe: 8,
      note: 'Good session',
    };
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    sessionRepository.saveOutcome.mockResolvedValue(completed);
    sessionRepository.updateStatus.mockResolvedValue(completed);

    const result = await useCase.execute(
      'session-1',
      'user-1',
      8,
      'Good session',
    );

    expect(sessionRepository.saveOutcome).toHaveBeenCalledWith(
      'session-1',
      8,
      'Good session',
    );
    expect(sessionRepository.updateStatus).toHaveBeenCalledWith(
      'session-1',
      'completed',
    );
    expect(result.status).toBe('completed');
  });

  it('transitions paused session to completed', async () => {
    const completed = makeSession('completed');
    sessionRepository.findById.mockResolvedValue(makeSession('paused'));
    sessionRepository.saveOutcome.mockResolvedValue(completed);
    sessionRepository.updateStatus.mockResolvedValue(completed);

    await useCase.execute('session-1', 'user-1', null, null);

    expect(sessionRepository.updateStatus).toHaveBeenCalledWith(
      'session-1',
      'completed',
    );
  });

  it('throws ConflictException when session is planned', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('planned'));
    await expect(
      useCase.execute('session-1', 'user-1', null, null),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when session is already completed', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('completed'));
    await expect(
      useCase.execute('session-1', 'user-1', null, null),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when session not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('unknown', 'user-1', null, null),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when session belongs to different user', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('active'));
    await expect(
      useCase.execute('session-1', 'user-99', null, null),
    ).rejects.toThrow(NotFoundException);
  });
});
