import type { NestExpressApplication } from '@nestjs/platform-express';
import { minutes, ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * HTTP rate limit, applied by the global ThrottlerGuard to every route.
 *
 * - Keyed on req.ip, resolved through `trust proxy` (see applyTrustProxy). IPv6
 *   clients are grouped by /64 (throttler default), so rotating addresses
 *   inside one allocation does not bypass it.
 * - Budgets are per route and per IP (the default key includes the
 *   controller and handler), not one global budget per IP.
 * - In-memory storage: counters reset on restart, fine for a single instance.
 */
export const THROTTLE_ERROR_MESSAGE =
  'Trop de tentatives, réessayez plus tard.';

export const THROTTLE_LIMIT = 100;

export const throttlerOptions: ThrottlerModuleOptions = {
  errorMessage: THROTTLE_ERROR_MESSAGE,
  ipv6SubnetPrefix: 64,
  throttlers: [{ ttl: minutes(1), limit: THROTTLE_LIMIT }],
};

/**
 * Number of reverse-proxy hops to trust for X-Forwarded-For (req.ip feeds
 * the rate limit). Production: 1 (Caddy, which drops client-sent
 * X-Forwarded-For since no trusted_proxies is configured). Unset in local
 * dev, otherwise any client could spoof its IP.
 */
export function applyTrustProxy(
  app: NestExpressApplication,
  hops: string | undefined,
): void {
  const trustProxyHops = Number(hops ?? 0);
  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
}
