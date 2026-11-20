import { Controller, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import {
  applyTrustProxy,
  THROTTLE_ERROR_MESSAGE,
  THROTTLE_LIMIT,
  throttlerOptions,
} from './throttling';

@Controller('ping')
class PingController {
  @Post()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

describe('Rate limiting (HTTP)', () => {
  let app: NestExpressApplication;
  const limit = THROTTLE_LIMIT;

  async function createApp(
    trustProxyHops: string | undefined,
  ): Promise<NestExpressApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerOptions)],
      controllers: [PingController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    applyTrustProxy(nestApp, trustProxyHops);
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  const ping = (ip: string) =>
    request(app.getHttpServer()).post('/ping').set('X-Forwarded-For', ip);

  it('answers 429 with a French message once the budget is spent, per IP', async () => {
    app = await createApp('1');
    for (let i = 0; i < limit; i++) {
      await ping('203.0.113.1').expect(201);
    }

    const blocked = await ping('203.0.113.1').expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
    expect(blocked.headers['retry-after']).toBeDefined();

    await ping('203.0.113.2').expect(201);
  });

  it('groups IPv6 clients by /64', async () => {
    app = await createApp('1');
    for (let i = 0; i < limit; i++) {
      await ping(`2001:db8:1:2::${i.toString(16)}`).expect(201);
    }

    expect((await ping('2001:db8:1:2:ffff::1')).status).toBe(429);
    expect((await ping('2001:db8:1:3::1')).status).toBe(201);
  });

  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    app = await createApp(undefined);
    for (let i = 0; i < limit; i++) {
      await ping(`198.51.100.${String(i)}`).expect(201);
    }

    expect((await ping('198.51.100.200')).status).toBe(429);
  });

  it('ignores a non-numeric TRUST_PROXY_HOPS', async () => {
    app = await createApp('true');
    for (let i = 0; i < limit; i++) {
      await ping(`198.51.100.${String(i)}`).expect(201);
    }

    expect((await ping('198.51.100.200')).status).toBe(429);
  });
});
