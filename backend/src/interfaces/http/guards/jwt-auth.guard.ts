import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { AccessTokenVerifier } from '../../../domain/auth/access-token-verifier';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { clearAuthCookies, setAuthCookies } from '../auth-cookies';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier,
    private readonly revokedSessionRepository: RevokedSessionRepository,
    private readonly oauthClient: OAuthClient,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    const accessToken = (request.cookies as Record<string, string>)
      .access_token;
    if (!accessToken) throw new UnauthorizedException();

    const payload = await this.verifier.verify(accessToken);

    if (!payload) {
      const refreshToken = (request.cookies as Record<string, string>)
        .refresh_token;
      if (!refreshToken) {
        throw new UnauthorizedException();
      }
      try {
        const newTokens = await this.oauthClient.refresh(refreshToken);
        const newPayload = await this.verifier.verify(newTokens.accessToken);
        if (!newPayload) throw new UnauthorizedException();
        setAuthCookies(response, newTokens, this.config);
        request.user = {
          id: newPayload.sub,
          email: newPayload.email,
          name: newPayload.name,
        };
        return true;
      } catch {
        clearAuthCookies(response);
        throw new UnauthorizedException();
      }
    }

    const revokedAt = await this.revokedSessionRepository.getRevokedAt(
      payload.sub,
    );
    if (revokedAt && revokedAt > payload.issuedAt) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    return true;
  }
}
