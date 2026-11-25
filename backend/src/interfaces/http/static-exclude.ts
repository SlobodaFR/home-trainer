/**
 * Paths ServeStatic must never answer with the SPA index.html: API 404s stay JSON.
 * Express 5 (path-to-regexp 8) syntax: `*path` needs a segment, so the bare prefix is listed too.
 */
export const STATIC_EXCLUDE = ['/api', '/api/{*path}'];
