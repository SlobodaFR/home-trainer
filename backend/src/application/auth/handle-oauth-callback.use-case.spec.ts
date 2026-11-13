import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { HandleOAuthCallbackUseCase } from './handle-oauth-callback.use-case';
import {
  OAuthClient,
  TokenPair,
  UserProfile,
} from '../../domain/auth/oauth-client';
import { UserRepository } from '../../domain/auth/user.repository';

const mockTokenPair: TokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

const mockProfile: UserProfile = {
  id: 'user-1',
  email: 'thomas@example.com',
  name: 'Thomas',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('HandleOAuthCallbackUseCase', () => {
  let useCase: HandleOAuthCallbackUseCase;
  let oauthClient: Mocked<OAuthClient>;
  let userRepository: Mocked<UserRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HandleOAuthCallbackUseCase,
        {
          provide: OAuthClient,
          useValue: {
            exchangeCode: vi.fn().mockResolvedValue(mockTokenPair),
            fetchUserInfo: vi.fn().mockResolvedValue(mockProfile),
          },
        },
        {
          provide: UserRepository,
          useValue: { save: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    useCase = module.get(HandleOAuthCallbackUseCase);
    oauthClient = module.get(OAuthClient);
    userRepository = module.get(UserRepository);
  });

  it('exchanges code and returns token pair', async () => {
    const result = await useCase.execute(
      'auth-code',
      'https://example.com/callback',
    );
    expect(oauthClient.exchangeCode).toHaveBeenCalledWith(
      'auth-code',
      'https://example.com/callback',
    );
    expect(result).toEqual(mockTokenPair);
  });

  it('fetches user info with access token', async () => {
    await useCase.execute('auth-code', 'https://example.com/callback');
    expect(oauthClient.fetchUserInfo).toHaveBeenCalledWith('access-token');
  });

  it('saves user with profile data', async () => {
    await useCase.execute('auth-code', 'https://example.com/callback');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        email: 'thomas@example.com',
        name: 'Thomas',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    );
  });
});
