import { Test } from '@nestjs/testing';
import { GetSessionByIdUseCase } from './get-session-by-id.use-case';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';

const mockSession: Session = {
  id: 'session-1',
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: '2026-07-07',
  status: 'planned',
  rpe: null,
  note: null,
  createdAt: new Date('2026-07-06'),
  exercises: [],
};

describe('GetSessionByIdUseCase', () => {
  let useCase: GetSessionByIdUseCase;
  let sessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetSessionByIdUseCase,
        {
          provide: SessionRepository,
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get(GetSessionByIdUseCase);
    sessionRepository = module.get(SessionRepository);
  });

  it('returns session when found and userId matches', async () => {
    sessionRepository.findById.mockResolvedValue(mockSession);
    const result = await useCase.execute('session-1', 'user-1');
    expect(result).toEqual(mockSession);
  });

  it('returns null when session not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    const result = await useCase.execute('unknown', 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when session belongs to a different user', async () => {
    sessionRepository.findById.mockResolvedValue(mockSession);
    const result = await useCase.execute('session-1', 'user-99');
    expect(result).toBeNull();
  });
});
