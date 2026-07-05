import { Test } from '@nestjs/testing';
import { HandleSessionRevokedUseCase } from './handle-session-revoked.use-case';
import { RevokedSessionRepository } from '../../domain/auth/revoked-session.repository';

describe('HandleSessionRevokedUseCase', () => {
  let useCase: HandleSessionRevokedUseCase;
  let revokedSessionRepository: jest.Mocked<RevokedSessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HandleSessionRevokedUseCase,
        {
          provide: RevokedSessionRepository,
          useValue: { markRevoked: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    useCase = module.get(HandleSessionRevokedUseCase);
    revokedSessionRepository = module.get(RevokedSessionRepository);
  });

  it('marks session revoked with userId and a Date', async () => {
    await useCase.execute('user-1');
    expect(revokedSessionRepository.markRevoked).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
    );
  });
});
