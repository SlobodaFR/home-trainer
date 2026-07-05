import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { TokenPair } from '../../domain/auth/oauth-client';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function setAuthCookies(
  res: Response,
  tokens: TokenPair,
  config: ConfigService,
): void {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
  };
  res.cookie('access_token', tokens.accessToken, base);
  res.cookie('refresh_token', tokens.refreshToken, {
    ...base,
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { path: '/', httpOnly: true });
  res.clearCookie('refresh_token', { path: '/', httpOnly: true });
}
