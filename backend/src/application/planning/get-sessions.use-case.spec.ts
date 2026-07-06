import { Test } from '@nestjs/testing';
import { GetSessionsUseCase } from './get-sessions.use-case';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

const mockSession: Session = {
  id: 'session-1',
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: '2026-07-07',
  status: 'planned',
  createdAt: new Date('2026-07-06'),
  exercises: [],
};

describe('GetSessionsUseCase', () => {
  let useCase: GetSessionsUseCase;
  let sessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetSessionsUseCase,
        {
          provide: SessionRepository,
          useValue: { findByUser: jest.fn().mockResolvedValue([mockSession]) },
        },
      ],
    }).compile();

    useCase = module.get(GetSessionsUseCase);
    sessionRepository = module.get(SessionRepository);
  });

  it('returns sessions from repository', async () => {
    const result = await useCase.execute('user-1', true);
    expect(result).toEqual([mockSession]);
  });

  it('passes onlyPlanned=true to repository', async () => {
    await useCase.execute('user-1', true);
    expect(sessionRepository.findByUser).toHaveBeenCalledWith('user-1', true);
  });

  it('passes onlyPlanned=false to repository when all sessions requested', async () => {
    await useCase.execute('user-1', false);
    expect(sessionRepository.findByUser).toHaveBeenCalledWith('user-1', false);
  });
});
