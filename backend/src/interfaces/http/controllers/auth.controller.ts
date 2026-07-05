import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString } from 'class-validator';
import { Response } from 'express';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { clearAuthCookies, setAuthCookies } from '../auth-cookies';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';

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
  me(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }

  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): void {
    clearAuthCookies(res);
  }

  @Public()
  @HttpCode(204)
  @Post('disconnect')
  async disconnect(
    @Query('secret') secret: string,
    @Body() body: DisconnectDto,
  ): Promise<void> {
    if (secret !== this.config.getOrThrow<string>('AUTH_WEBHOOK_SECRET')) {
      throw new UnauthorizedException();
    }
    await this.handleSessionRevoked.execute(body.userId);
  }
}
