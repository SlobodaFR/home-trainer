import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ResumeSessionUseCase } from './resume-session.use-case';
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

describe('ResumeSessionUseCase', () => {
  let useCase: ResumeSessionUseCase;
  let sessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ResumeSessionUseCase,
        {
          provide: SessionRepository,
          useValue: {
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(ResumeSessionUseCase);
    sessionRepository = module.get(SessionRepository);
  });

  it('transitions paused session to active', async () => {
    const active = makeSession('active');
    sessionRepository.findById.mockResolvedValue(makeSession('paused'));
    sessionRepository.updateStatus.mockResolvedValue(active);

    const result = await useCase.execute('session-1', 'user-1');

    expect(sessionRepository.updateStatus).toHaveBeenCalledWith(
      'session-1',
      'active',
    );
    expect(result.status).toBe('active');
  });

  it('throws ConflictException when session is planned', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('planned'));
    await expect(useCase.execute('session-1', 'user-1')).rejects.toThrow(
      ConflictException,
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

  it('throws NotFoundException when session not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('unknown', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when session belongs to different user', async () => {
    sessionRepository.findById.mockResolvedValue(makeSession('paused'));
    await expect(useCase.execute('session-1', 'user-99')).rejects.toThrow(
      NotFoundException,
    );
  });
});
