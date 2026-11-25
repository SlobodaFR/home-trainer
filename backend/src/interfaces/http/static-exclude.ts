/**
 * Paths ServeStatic must never answer with the SPA index.html: API 404s stay JSON.
 * Express 5 (path-to-regexp 8) syntax; the old `/api/*path` let a bare GET /api fall through to the SPA.
 * The bare `/api` entry is belt and braces: serve-static matches with a trailing slash today.
 */
export const STATIC_EXCLUDE = ['/api', '/api/{*path}'];
