import type { IncomingMessage } from 'http';
import { Writable } from 'stream';
import pino from 'pino';
import { QueryFailedError } from 'typeorm';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import { loggerParams, REDACT_PATHS } from './logger.config';

type Serializer = (value: unknown) => unknown;

const SECRET = 'x'.repeat(48);

function options(): Record<string, unknown> {
  return loggerParams('production', SECRET).pinoHttp as Record<string, unknown>;
}

function serializers(): { req: Serializer; res: Serializer } {
  return options().serializers as { req: Serializer; res: Serializer };
}

describe('logger configuration', () => {
  it('logs requests as method and path only: no query string, headers or IP', () => {
    const serialized = serializers().req({
      method: 'GET',
      url: '/api/auth/callback?code=abc&state=s',
      headers: { cookie: 'access_token=x', authorization: 'Bearer y' },
      remoteAddress: '203.0.113.7',
    });

    expect(serialized).toEqual({ method: 'GET', url: '/api/auth/callback' });
  });

  it('logs responses as status code only: no Location or Set-Cookie header', () => {
    const serialized = serializers().res({
      statusCode: 302,
      headers: {
        location: 'https://app.example.com/cb?code=secret',
        'set-cookie': 'access_token=jwt',
      },
    });

    expect(serialized).toEqual({ statusCode: 302 });
  });

  it('redacts personal and secret fields in structured log objects', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ redact: REDACT_PATHS }, stream);

    logger.info(
      {
        user: { email: 'a@b.c', token: 't0k3n', refresh_token: 'r3fr3sh' },
        err: { code: 'SQLITE_BUSY' },
      },
      'event',
    );

    const output = lines.join('');
    expect(output).not.toContain('a@b.c');
    expect(output).not.toContain('t0k3n');
    expect(output).not.toContain('r3fr3sh');
    expect(output).toContain('SQLITE_BUSY');
  });

  it('tags requests with a pseudonym of the user, never the id itself', () => {
    const customProps = options().customProps as (
      req: IncomingMessage,
    ) => Record<string, unknown>;

    const props = customProps({ user: { id: 'user-42' } } as never);

    expect(props).toEqual({ user: pseudonymize('user-42', SECRET) });
    expect(JSON.stringify(props)).not.toContain('user-42');
    expect(customProps({} as IncomingMessage)).toEqual({});
  });

  it('logs client errors as warn and server errors as error', () => {
    const level = options().customLogLevel as (
      req: unknown,
      res: { statusCode: number },
      err?: Error,
    ) => string;

    expect(level({}, { statusCode: 200 })).toBe('info');
    expect(level({}, { statusCode: 404 })).toBe('warn');
    expect(level({}, { statusCode: 500 })).toBe('error');
    expect(level({}, { statusCode: 200 }, new Error('boom'))).toBe('error');
  });

  it('skips automatic request logs for static and noisy routes', () => {
    const ignore = (
      options().autoLogging as { ignore: (req: { url?: string }) => boolean }
    ).ignore;

    expect(ignore({ url: '/assets/index-abc.js' })).toBe(true);
    expect(ignore({ url: '/api/docs/swagger-ui.css' })).toBe(true);
    expect(ignore({ url: '/api/health' })).toBe(true);
    expect(ignore({ url: '/healthz' })).toBe(true);
    expect(ignore({ url: '/api/goals' })).toBe(false);
  });

  it('pretty-prints only in development', () => {
    expect(
      (loggerParams('development', SECRET).pinoHttp as Record<string, unknown>)
        .transport,
    ).toEqual({ target: 'pino-pretty' });
    expect(options().transport).toBeUndefined();
  });

  // Nest logs any non-HTTP exception as { err }; pino's default serializer would copy
  // QueryFailedError.parameters / query / driverError (emails, names, health notes).
  it('never logs the parameters or query of a failed SQL statement', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino(
      {
        redact: REDACT_PATHS,
        serializers: {
          err: (options().serializers as { err: Serializer }).err as (
            value: unknown,
          ) => object,
        },
      },
      stream,
    );
    const driverError = Object.assign(
      new Error('SQLITE_BUSY: database is locked'),
      {
        code: 'SQLITE_BUSY',
      },
    );
    const error = new QueryFailedError(
      'INSERT INTO users (email, name) VALUES (?, ?)',
      ['alice@example.com', 'Alice Martin', 'injured knee, post-surgery'],
      driverError,
    );

    logger.error({ err: error }, 'ExceptionsHandler');

    const output = lines.join('');
    expect(output).not.toContain('alice@example.com');
    expect(output).not.toContain('Alice Martin');
    expect(output).not.toContain('injured knee');
    expect(output).not.toContain('INSERT INTO');
    expect(output).toContain('SQLITE_BUSY');
    expect(output).toContain('QueryFailedError');
  });

  it('keeps only type, message, stack and code of an error', () => {
    const err = options().serializers as { err: Serializer };

    const serialized = err.err(
      Object.assign(new Error('boom'), {
        code: 'E1',
        response: { secret: 'x' },
        config: { headers: 'y' },
        cause: new Error('inner alice@example.com'),
      }),
    ) as Record<string, unknown>;

    expect(Object.keys(serialized).sort()).toEqual([
      'code',
      'message',
      'stack',
      'type',
    ]);
  });

  it('strips keys and emails from the logged message', () => {
    const err = options().serializers as { err: Serializer };

    const serialized = err.err(
      new Error('Incorrect API key sk-proj-****WXYZ for bob@example.com'),
    ) as { message: string; stack: string };

    expect(JSON.stringify(serialized)).not.toContain('sk-');
    expect(JSON.stringify(serialized)).not.toContain('bob@example.com');
  });
});
