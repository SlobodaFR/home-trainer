import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AccessTokenPayload } from '../../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../../domain/auth/access-token-verifier';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';

const mockPayload: AccessTokenPayload = {
  sub: 'user-1',
  email: 'thomas@example.com',
  name: 'Thomas',
  issuedAt: new Date('2026-01-01T00:00:00Z'),
};

function makeContext(
  cookies: Record<string, string>,
  isPublic: boolean,
  reflector: jest.Mocked<Reflector>,
): ExecutionContext {
  reflector.getAllAndOverride.mockReturnValue(isPublic);
  const mockRequest: { cookies: Record<string, string>; user?: unknown } = {
    cookies,
    user: undefined,
  };
  const mockResponse = { cookie: jest.fn(), clearCookie: jest.fn() };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let verifier: jest.Mocked<AccessTokenVerifier>;
  let revokedRepo: jest.Mocked<RevokedSessionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        {
          provide: AccessTokenVerifier,
          useValue: { verify: jest.fn() },
        },
        {
          provide: RevokedSessionRepository,
          useValue: { getRevokedAt: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: OAuthClient,
          useValue: { refresh: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('development') },
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
    verifier = module.get(AccessTokenVerifier);
    revokedRepo = module.get(RevokedSessionRepository);
  });

  it('allows public routes without checking token', async () => {
    const ctx = makeContext({}, true, reflector);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('allows valid token with no revocation', async () => {
    verifier.verify.mockResolvedValue(mockPayload);
    revokedRepo.getRevokedAt.mockResolvedValue(null);
    const ctx = makeContext({ access_token: 'valid-token' }, false, reflector);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws 401 when no access_token cookie', async () => {
    const ctx = makeContext({}, false, reflector);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when session is revoked', async () => {
    verifier.verify.mockResolvedValue(mockPayload);
    revokedRepo.getRevokedAt.mockResolvedValue(
      new Date('2026-06-01T00:00:00Z'),
    );
    const ctx = makeContext({ access_token: 'valid-token' }, false, reflector);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
