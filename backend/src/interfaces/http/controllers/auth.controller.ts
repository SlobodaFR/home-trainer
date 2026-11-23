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
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { WebhookAuthenticator } from '../../../infrastructure/auth/webhook-authenticator';
import { clearAuthCookies, setAuthCookies } from '../auth-cookies';
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
  ) {}

  private callbackUrl(): string {
    return new URL(
      '/api/auth/callback',
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

  @HttpCode(204)
  @Post('logout')
  @UseGuards(SameOriginGuard)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearAuthCookies(res);
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
