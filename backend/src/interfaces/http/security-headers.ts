import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

const COMMON = {
  strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true }, // no preload: hard to undo
  frameguard: { action: 'deny' as const },
  referrerPolicy: { policy: 'no-referrer' as const },
};

function buildStrict(
  authBaseUrl: string | undefined,
): ReturnType<typeof helmet> {
  // Profile avatars come from the auth service (/avatars/:id) or ui-avatars (generated).
  const avatarSources = ['https://ui-avatars.com'];
  if (authBaseUrl) {
    avatarSources.push(new URL(authBaseUrl).origin);
  }
  return helmet({
    ...COMMON,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        // wger.de: exercise photos and muscle diagrams (hotlinked); data: for inlined assets.
        imgSrc: ["'self'", 'data:', 'https://wger.de', ...avatarSources],
        connectSrc: ["'self'"],
        // Exercise video embeds.
        frameSrc: [
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
        ],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  });
}

// Swagger UI needs inline scripts; /api/docs is not served in production.
const withoutCsp = helmet({ ...COMMON, contentSecurityPolicy: false });

/** Security headers for every response: API, SPA static files and /api/docs. */
export function applySecurityHeaders(
  app: NestExpressApplication,
  options: { authBaseUrl?: string } = {},
): void {
  const strict = buildStrict(options.authBaseUrl);
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Express routing is case-insensitive: match the same way.
    const path = req.path.toLowerCase();
    const middleware =
      path === '/api/docs' || path.startsWith('/api/docs/')
        ? withoutCsp
        : strict;
    middleware(req, res, next);
  });
}
