import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule } from 'nestjs-pino';
import { Writable } from 'stream';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { loggerParams } from './logger.config';

interface LogLine {
  context?: string;
  res?: unknown;
  err?: { type?: string; stack?: string } & Record<string, unknown>;
}

@Controller()
class BoomController {
  @Get('boom')
  boom(): never {
    const driverError = Object.assign(
      new Error('SQLITE_BUSY: database is locked'),
      { code: 'SQLITE_BUSY' },
    );
    throw new QueryFailedError(
      'INSERT INTO workout (name, notes) VALUES (?, ?)',
      ['Alice Martin', 'alice@example.com'],
      driverError,
    );
  }
}

describe('request logging through Nest and pino-http', () => {
  let app: NestExpressApplication;
  const lines: string[] = [];

  beforeAll(async () => {
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const params = loggerParams('production', 'x'.repeat(48));
    const pinoHttp = {
      ...(params.pinoHttp as object),
      level: 'info',
      transport: undefined,
    };
    @Module({
      imports: [LoggerModule.forRoot({ pinoHttp: [pinoHttp, stream] })],
      controllers: [BoomController],
    })
    class TestModule {}
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    });
    app.useLogger(app.get(Logger));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps type and stack but no query, parameters or driver error on the completion line', async () => {
    await request(app.getHttpServer()).get('/boom').expect(500);

    const output = lines.join('');
    expect(output).not.toContain('alice@example.com');
    expect(output).not.toContain('Alice Martin');
    expect(output).not.toContain('INSERT INTO');
    const entries = lines.map((line) => JSON.parse(line) as LogLine);
    // Nest's exception handler logs the thrown error as a plain Error rebuilt from message + stack...
    const thrown = entries.find(
      (entry) => entry.context === 'ExceptionsHandler',
    );
    expect(thrown?.err?.stack).toContain('QueryFailedError');
    // ...and pino-http's completion line carries its own (already serialized) error.
    const completion = entries.find((entry) => entry.res !== undefined);
    expect(completion?.err?.type).toBe('Error');
    expect(completion?.err?.stack).toEqual(expect.any(String));
    for (const entry of [thrown, completion]) {
      expect(entry?.err?.type).toMatch(/Error$/);
      for (const key of Object.keys(entry?.err ?? {})) {
        expect(['type', 'message', 'stack', 'code']).toContain(key);
      }
    }
  });
});
