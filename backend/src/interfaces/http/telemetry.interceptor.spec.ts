import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  Controller,
  ExecutionContext,
  Get,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import request from 'supertest';
import { lastValueFrom, of } from 'rxjs';
import { Telemetry, TelemetryEvent } from '../../domain/shared/telemetry';
import { TelemetryInterceptor } from './telemetry.interceptor';

class FakeTelemetry extends Telemetry {
  readonly captured: TelemetryEvent[] = [];

  capture(event: TelemetryEvent): void {
    this.captured.push(event);
  }
}

@Controller('exercises')
class ExercisesController {
  @Get('missing')
  missing(): never {
    throw new NotFoundException('nope');
  }

  @Get('boom')
  boom(): never {
    throw new TypeError('secret detail about alice@example.com');
  }

  @Get(':id')
  find(@Param('id') id: string): { id: string } {
    return { id };
  }
}

@Controller('health')
class HealthController {
  @Get()
  health(): string {
    return 'ok';
  }
}

@Controller('version')
class VersionController {
  @Get()
  version(): string {
    return 'ok';
  }
}

@Controller('healthz')
class RuntimeHealthController {
  @Get()
  healthz(): string {
    return 'ok';
  }
}

describe('HTTP telemetry', () => {
  let app: NestExpressApplication;
  let telemetry: FakeTelemetry;
  let staticRoot: string;

  beforeEach(async () => {
    staticRoot = mkdtempSync(join(tmpdir(), 'trainer-spa-'));
    writeFileSync(join(staticRoot, 'index.html'), '<html>spa</html>');
    writeFileSync(join(staticRoot, 'app.js'), 'console.log(1)');

    telemetry = new FakeTelemetry();
    @Module({
      imports: [
        // Same wiring as AppModule in production: the SPA is served outside the Nest routes.
        ServeStaticModule.forRoot({
          rootPath: staticRoot,
          exclude: ['/api/*path'],
        }),
      ],
      controllers: [
        ExercisesController,
        HealthController,
        RuntimeHealthController,
        VersionController,
      ],
      providers: [
        { provide: Telemetry, useValue: telemetry },
        { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
      ],
    })
    class TestAppModule {}
    // NestFactory (not Test): ServeStaticModule needs the HTTP adapter at module init, as in main.ts.
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, {
      logger: false,
    });
    // Same prefix as main.ts.
    app.setGlobalPrefix('api', { exclude: ['healthz', 'version'] });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(staticRoot, { recursive: true, force: true });
  });

  it('reports each request with its route template, never the raw URL or query', async () => {
    await request(app.getHttpServer())
      .get('/api/exercises/42?token=secret')
      .expect(200);

    expect(telemetry.captured).toEqual([
      {
        name: 'http_request',
        properties: {
          route: '/api/exercises/:id',
          method: 'GET',
          status: 200,
          duration_ms: expect.any(Number),
        },
      },
    ]);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/42|secret/);
  });

  it('reports client errors with their status', async () => {
    await request(app.getHttpServer())
      .get('/api/exercises/missing')
      .expect(404);

    expect(telemetry.captured).toEqual([
      {
        name: 'http_request',
        properties: expect.objectContaining({
          route: '/api/exercises/missing',
          status: 404,
        }),
      },
    ]);
  });

  it('reports server errors as status 500 without the error message', async () => {
    await request(app.getHttpServer()).get('/api/exercises/boom').expect(500);

    expect(telemetry.captured).toEqual([
      {
        name: 'http_request',
        properties: expect.objectContaining({
          route: '/api/exercises/boom',
          status: 500,
        }),
      },
    ]);
    expect(JSON.stringify(telemetry.captured)).not.toContain('alice');
  });

  it('does not report /healthz (polled by the Docker healthcheck every 30 s)', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('does not report /version (public release identity, cost amplifier)', async () => {
    await request(app.getHttpServer()).get('/version').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('does not report /api/health (public sibling of /healthz, probed externally)', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('reports nothing for a request that matches no Nest route', async () => {
    await request(app.getHttpServer())
      .get('/api/nope/alice@example.com')
      .expect(404);

    expect(telemetry.captured).toEqual([]);
  });

  it('reports nothing for static assets and SPA routes served by ServeStatic', async () => {
    await request(app.getHttpServer()).get('/app.js').expect(200);
    await request(app.getHttpServer()).get('/').expect(200);
    await request(app.getHttpServer()).get('/sessions/42').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('ignores non-HTTP contexts: a WebSocket handler sharing the global interceptor emits nothing', async () => {
    const interceptor = new TelemetryInterceptor(telemetry);
    const next = { handle: () => of('pong') };
    const wsContext = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('must not read an HTTP request on a ws context');
      },
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(wsContext, next));

    expect(telemetry.captured).toEqual([]);
  });

  it('never reports an email carried by a query string or a path parameter', async () => {
    await request(app.getHttpServer())
      .get('/api/exercises/alice@example.com?email=bob@example.com')
      .expect(200);

    expect(telemetry.captured).toHaveLength(1);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/alice|bob|@/);
    expect(telemetry.captured[0]).toMatchObject({
      properties: { route: '/api/exercises/:id' },
    });
  });
});
