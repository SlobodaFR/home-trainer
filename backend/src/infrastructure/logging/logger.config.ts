import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import { sanitizeErrorText } from '../../domain/shared/sanitize-error-text';

/**
 * Defense in depth only: pino redaction matches object keys (one level per `*`) and never looks
 * inside message strings. The real control is that log messages never interpolate personal data
 * (use pseudonymize()) and that request/response serializers keep no headers, query or body.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'res.headers.location',
  '*.email',
  '*.token',
  '*.access_token',
  '*.refresh_token',
  '*.client_secret',
  '*.code_verifier',
];

const QUIET_PATHS = [
  /^\/assets\//,
  /^\/everkinetic\//,
  /^\/api\/docs(\/|$)/,
  /^\/api\/health\/?$/,
  /^\/healthz\/?$/,
];

function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0];
}

/**
 * Allow-list: pino's default serializer copies every enumerable property, and TypeORM's
 * QueryFailedError carries `query`, `parameters` and `driverError` (emails, names, health notes).
 * Only the error type, a sanitized message and stack, and its code are logged.
 */
export function serializeError(err: unknown): {
  type: string;
  message: string;
  stack?: string;
  code?: string | number;
} {
  if (!(err instanceof Error)) {
    return { type: typeof err, message: '' };
  }
  const { code } = err as Error & { code?: unknown };
  return {
    type: err.constructor.name,
    message: sanitizeErrorText(err.message, 500),
    stack: err.stack ? sanitizeErrorText(err.stack, 4000) : undefined,
    code:
      typeof code === 'string' || typeof code === 'number' ? code : undefined,
  };
}

interface RequestWithUser extends IncomingMessage {
  user?: { id?: string };
}

export function loggerParams(
  nodeEnv: string | undefined,
  pseudonymSecret: string,
): Params {
  return {
    pinoHttp: {
      level: nodeEnv === 'test' ? 'silent' : 'info',
      redact: REDACT_PATHS,
      serializers: {
        // No headers (cookies, tokens), no query string (OAuth code/state), no IP.
        req: (req: IncomingMessage) => ({
          method: req.method,
          url: pathOf(req.url),
        }),
        // No headers: Location carries authorization codes, Set-Cookie the session token.
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        err: serializeError,
      },
      // Correlate a user's requests without ever logging who they are.
      customProps: (req: IncomingMessage) => {
        const id = (req as RequestWithUser).user?.id;
        return id ? { user: pseudonymize(id, pseudonymSecret) } : {};
      },
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          QUIET_PATHS.some((pattern) => pattern.test(pathOf(req.url))),
      },
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },
      transport:
        nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  };
}
