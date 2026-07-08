import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient, TokenPair } from '../../../domain/auth/oauth-client';

const mockTokens: TokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

describe('AuthController', () => {
  let controller: AuthController;
  let oauthClient: jest.Mocked<OAuthClient>;
  let handleSessionRevoked: jest.Mocked<HandleSessionRevokedUseCase>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: OAuthClient,
          useValue: {
            authorizeUrl: jest
              .fn()
              .mockReturnValue(
                'https://auth.sloboda.fr/authorize?client_id=trainer&redirect_uri=http://localhost:5173/api/auth/callback',
              ),
            exchangeCode: jest.fn().mockResolvedValue(mockTokens),
          },
        },
        {
          provide: HandleOAuthCallbackUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(mockTokens) },
        },
        {
          provide: HandleSessionRevokedUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                FRONTEND_URL: 'http://localhost:5173',
                AUTH_WEBHOOK_SECRET: 'webhook-secret',
                NODE_ENV: 'development',
              };
              return map[key];
            }),
            get: jest.fn().mockReturnValue('development'),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    oauthClient = module.get(OAuthClient);
    handleSessionRevoked = module.get(HandleSessionRevokedUseCase);
  });

  describe('login', () => {
    it('redirects to authorize URL containing client_id', () => {
      const mockRedirect = jest.fn();
      const mockRes = {
        redirect: mockRedirect,
      } as unknown as import('express').Response;
      controller.login(mockRes);
      expect(oauthClient.authorizeUrl).toHaveBeenCalledWith(
        'http://localhost:5173/api/auth/callback',
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining('client_id=trainer'),
      );
    });
  });

  describe('me', () => {
    it('returns enriched user payload from home-auth /me', async () => {
      const user = {
        id: 'user-1',
        email: 'thomas@example.com',
        name: 'Thomas',
      };
      oauthClient.fetchMe = jest.fn().mockResolvedValue({
        name: 'Thomas',
        email: 'thomas@example.com',
        avatarUrl: null,
        language: 'fr',
        country: 'FR',
      });
      const mockReq = {
        accessToken: 'access-token',
      } as unknown as import('express').Request;
      const result = await controller.me(user, mockReq);
      expect(result).toMatchObject({ ...user, language: 'fr' });
    });

    it('falls back gracefully when fetchMe fails', async () => {
      const user = {
        id: 'user-1',
        email: 'thomas@example.com',
        name: 'Thomas',
      };
      oauthClient.fetchMe = jest.fn().mockRejectedValue(new Error('network'));
      const mockReq = {
        accessToken: 'access-token',
      } as unknown as import('express').Request;
      const result = await controller.me(user, mockReq);
      expect(result).toMatchObject({
        ...user,
        language: 'en',
        avatarUrl: null,
      });
    });
  });

  describe('disconnect', () => {
    it('throws 401 with wrong secret', async () => {
      await expect(
        controller.disconnect('wrong-secret', { userId: 'user-1' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(handleSessionRevoked.execute).not.toHaveBeenCalled();
    });

    it('calls handleSessionRevoked with correct secret', async () => {
      await controller.disconnect('webhook-secret', { userId: 'user-1' });
      expect(handleSessionRevoked.execute).toHaveBeenCalledWith('user-1');
    });
  });
});
