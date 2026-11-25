import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { TokenPair } from '../../domain/auth/oauth-client';

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
export const LOGOUT_STATE_COOKIE_NAME = 'logout_state';

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

const LOGOUT_STATE_MAX_AGE_MS = 10 * 60 * 1000;

/** Same options for set and clear: express only clears a cookie whose Path matches. */
function logoutStateCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
  };
}

/** Short-lived anti-CSRF `state` of the service-initiated logout (PC10), checked on return. */
export function setLogoutStateCookie(
  res: Response,
  state: string,
  config: ConfigService,
): void {
  res.cookie(LOGOUT_STATE_COOKIE_NAME, state, {
    ...logoutStateCookieOptions(config),
    maxAge: LOGOUT_STATE_MAX_AGE_MS,
  });
}

export function clearLogoutStateCookie(
  res: Response,
  config: ConfigService,
): void {
  res.clearCookie(LOGOUT_STATE_COOKIE_NAME, logoutStateCookieOptions(config));
}
