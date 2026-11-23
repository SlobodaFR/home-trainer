import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { AuthController } from './auth.controller';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient, TokenPair } from '../../../domain/auth/oauth-client';
import { WebhookAuthenticator } from '../../../infrastructure/auth/webhook-authenticator';
import { SameOriginGuard } from '../guards/same-origin.guard';

const mockTokens: TokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

describe('AuthController', () => {
  let controller: AuthController;
  let oauthClient: Mocked<OAuthClient>;
  let handleSessionRevoked: Mocked<HandleSessionRevokedUseCase>;
  let webhookAuthenticator: Mocked<WebhookAuthenticator>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: OAuthClient,
          useValue: {
            authorizeUrl: vi
              .fn()
              .mockReturnValue(
                'https://auth.sloboda.fr/authorize?client_id=trainer&redirect_uri=http://localhost:5173/api/auth/callback',
              ),
            exchangeCode: vi.fn().mockResolvedValue(mockTokens),
          },
        },
        {
          provide: HandleOAuthCallbackUseCase,
          useValue: { execute: vi.fn().mockResolvedValue(mockTokens) },
        },
        {
          provide: HandleSessionRevokedUseCase,
          useValue: { execute: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: WebhookAuthenticator,
          useValue: { authenticate: vi.fn().mockResolvedValue(true) },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) => {
              const map: Record<string, string> = {
                FRONTEND_URL: 'http://localhost:5173',
                AUTH_WEBHOOK_SECRET: 'webhook-secret',
                NODE_ENV: 'development',
              };
              return map[key];
            }),
            get: vi.fn().mockReturnValue('development'),
          },
        },
      ],
    })
      .overrideGuard(SameOriginGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
    oauthClient = module.get(OAuthClient);
    handleSessionRevoked = module.get(HandleSessionRevokedUseCase);
    webhookAuthenticator = module.get(WebhookAuthenticator);
  });

  describe('login', () => {
    it('redirects to authorize URL containing client_id', () => {
      const mockRedirect = vi.fn();
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
      oauthClient.fetchMe = vi.fn().mockResolvedValue({
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
      oauthClient.fetchMe = vi.fn().mockRejectedValue(new Error('network'));
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
    const rawBody = Buffer.from('{"userId":"user-1"}');
    function webhookRequest(headers: Record<string, string> = {}) {
      return {
        rawBody,
        get: (name: string) => headers[name.toLowerCase()],
      } as unknown as import('@nestjs/common').RawBodyRequest<
        import('express').Request
      >;
    }

    it('throws 401 and revokes nothing when the webhook is not authentic', async () => {
      webhookAuthenticator.authenticate.mockResolvedValueOnce(false);
      await expect(
        controller.disconnect(webhookRequest(), 'wrong-secret', {
          userId: 'user-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(handleSessionRevoked.execute).not.toHaveBeenCalled();
    });

    it('revokes the user when the webhook is authentic', async () => {
      await controller.disconnect(webhookRequest(), 'webhook-secret', {
        userId: 'user-1',
      });
      expect(handleSessionRevoked.execute).toHaveBeenCalledWith('user-1');
    });

    it('hands the raw body, the three signature headers and the query secret to the authenticator', async () => {
      await controller.disconnect(
        webhookRequest({
          'x-auth-webhook-id': 'the-id',
          'x-auth-webhook-timestamp': '1700000000',
          'x-auth-webhook-signature': 'v1=abc',
        }),
        'legacy',
        { userId: 'user-1' },
      );
      expect(webhookAuthenticator.authenticate).toHaveBeenCalledWith({
        rawBody,
        id: 'the-id',
        timestamp: '1700000000',
        signature: 'v1=abc',
        legacySecret: 'legacy',
      });
    });
  });
});
