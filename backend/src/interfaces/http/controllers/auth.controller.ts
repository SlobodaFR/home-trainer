import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString } from 'class-validator';
import { Request, Response } from 'express';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { InitiateServiceLogoutUseCase } from '../../../application/auth/initiate-service-logout.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { WebhookAuthenticator } from '../../../infrastructure/auth/webhook-authenticator';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  LOGOUT_STATE_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  clearAuthCookies,
  clearLogoutStateCookie,
  setAuthCookies,
  setLogoutStateCookie,
} from '../auth-cookies';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { SameOriginGuard } from '../guards/same-origin.guard';

class DisconnectDto {
  @IsString()
  userId!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly handleOAuthCallback: HandleOAuthCallbackUseCase,
    private readonly handleSessionRevoked: HandleSessionRevokedUseCase,
    private readonly oauthClient: OAuthClient,
    private readonly webhookAuthenticator: WebhookAuthenticator,
    private readonly config: ConfigService,
    private readonly initiateServiceLogout: InitiateServiceLogoutUseCase,
  ) {}

  private callbackUrl(): string {
    return this.frontendUrl('/api/auth/callback');
  }

  private frontendUrl(path: string): string {
    return new URL(
      path,
      this.config.getOrThrow<string>('FRONTEND_URL'),
    ).toString();
  }

  @Public()
  @Get('login')
  login(@Res() res: Response): void {
    res.redirect(this.oauthClient.authorizeUrl(this.callbackUrl()));
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.handleOAuthCallback.execute(
      code,
      this.callbackUrl(),
    );
    setAuthCookies(res, tokens, this.config);
    res.redirect(this.config.getOrThrow<string>('FRONTEND_URL'));
  }

  @Get('me')
  async me(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<
    CurrentUserPayload & { avatarUrl: string | null; language: string }
  > {
    const accessToken = (req as Request & { accessToken?: string }).accessToken;
    if (!accessToken) return { ...user, avatarUrl: null, language: 'en' };
    try {
      const profile = await this.oauthClient.fetchMe(accessToken);
      return {
        ...user,
        avatarUrl: profile.avatarUrl,
        language: profile.language,
      };
    } catch {
      return { ...user, avatarUrl: null, language: 'en' };
    }
  }

  /**
   * Local logout. Behind `auth-rp-initiated-logout`, also returns the home-auth logout URL (PC10)
   * for the SPA to reach by a top-level navigation; `redirect_to` is null otherwise (local-only).
   * Public (an expired session must still be able to log out) but POST + SameOriginGuard: no
   * logout-CSRF. Local cookies are always dropped, the refresh token included (home-auth revokes
   * nothing).
   */
  @Public()
  @HttpCode(200)
  @Post('logout')
  @UseGuards(SameOriginGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ redirect_to: string | null }> {
    // The body may carry a bearer token hint: never cached.
    res.setHeader('Cache-Control', 'no-store');
    const state = randomBytes(32).toString('base64url');
    let redirectTo: string | null = null;
    try {
      redirectTo = await this.initiateServiceLogout.execute({
        accessToken: cookieValue(req, ACCESS_TOKEN_COOKIE_NAME),
        refreshToken: cookieValue(req, REFRESH_TOKEN_COOKIE_NAME),
        state,
        postLogoutRedirectUri: this.frontendUrl('/api/auth/logged-out'),
      });
    } catch {
      // Falls back to the local-only logout.
    }
    clearAuthCookies(res);
    if (redirectTo) {
      setLogoutStateCookie(res, state, this.config);
    }
    return { redirect_to: redirectTo };
  }

  /**
   * Return from home-auth after a service-initiated logout. No effect besides dropping the state
   * cookie: the state must match the one stored by POST /auth/logout (missing, repeated or
   * different: neutral /login, no banner). Never starts /authorize.
   */
  @Public()
  @Get('logged-out')
  loggedOut(
    @Query('state') state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.setHeader('Cache-Control', 'no-store');
    const expected = cookieValue(req, LOGOUT_STATE_COOKIE_NAME);
    const matches =
      typeof state === 'string' &&
      state !== '' &&
      expected !== undefined &&
      timingSafeEqual(sha256(state), sha256(expected));
    clearLogoutStateCookie(res, this.config);
    res.redirect(this.frontendUrl(matches ? '/login?logged_out=1' : '/login'));
  }

  /**
   * Logout webhook from home-auth. Authenticated by its signature (headers X-Auth-Webhook-*, over
   * the raw body) or, during the transition, by the legacy `?secret=` (see WebhookAuthenticator).
   */
  @Public()
  @HttpCode(204)
  @Post('disconnect')
  async disconnect(
    @Req() req: RawBodyRequest<Request>,
    @Query('secret') secret: unknown,
    @Body() body: DisconnectDto,
  ): Promise<void> {
    const authentic = await this.webhookAuthenticator.authenticate({
      rawBody: req.rawBody,
      id: req.get('x-auth-webhook-id'),
      timestamp: req.get('x-auth-webhook-timestamp'),
      signature: req.get('x-auth-webhook-signature'),
      legacySecret: secret,
    });
    if (!authentic) {
      throw new UnauthorizedException();
    }
    await this.handleSessionRevoked.execute(body.userId);
  }
}

function cookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
