import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Telemetry } from '../domain/shared/telemetry';
import { PostHogTelemetry } from '../infrastructure/telemetry/posthog-telemetry';
import { TelemetryModule } from './telemetry.module';

describe('TelemetryModule', () => {
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it('provides the Telemetry port as a NOOP adapter when POSTHOG_API_KEY is absent', async () => {
    delete process.env.POSTHOG_API_KEY;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TelemetryModule,
      ],
    }).compile();

    const telemetry = module.get(Telemetry);

    expect(telemetry).toBeInstanceOf(PostHogTelemetry);
    expect(() => {
      telemetry.capture({
        name: 'runtime_health',
        properties: {
          lag_p50_ms: 0,
          lag_p99_ms: 0,
          lag_max_ms: 0,
          elu: 0,
          rss_mb: 1,
          heap_used_mb: 1,
        },
      });
    }).not.toThrow();
    await module.close();
  });

  it('is global: other modules inject the port without importing the module', async () => {
    @Injectable()
    class Consumer {
      constructor(readonly telemetry: Telemetry) {}
    }
    @Module({ providers: [Consumer] })
    class ConsumerModule {}

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TelemetryModule,
        ConsumerModule,
      ],
    }).compile();

    expect(module.get(Consumer).telemetry).toBeInstanceOf(Telemetry);
    await module.close();
  });

  it('registers the interceptor globally', async () => {
    @Controller('ping')
    class PingController {
      @Get()
      ping(): string {
        return 'pong';
      }
    }
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TelemetryModule,
      ],
      controllers: [PingController],
    }).compile();
    const app = module.createNestApplication<NestExpressApplication>();
    const captured: unknown[] = [];
    vi.spyOn(module.get(Telemetry), 'capture').mockImplementation((event) => {
      captured.push(event);
    });
    await app.init();

    await request(app.getHttpServer()).get('/ping').expect(200);

    expect(captured).toEqual([
      {
        name: 'http_request',
        properties: expect.objectContaining({ route: '/ping', status: 200 }),
      },
    ]);
    await app.close();
  });
});
