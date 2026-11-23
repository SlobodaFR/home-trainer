import type { Request } from 'express';

/**
 * Parameterized route of a request ('/api/exercises/:id'), never the raw URL: no ids, query string
 * or tokens. Requests that matched no Nest route give 'unknown' (the interceptor then reports nothing).
 */
export function routeOf(req: Request): string {
  const path = (req.route as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' ? `${req.baseUrl}${path}` : 'unknown';
}
