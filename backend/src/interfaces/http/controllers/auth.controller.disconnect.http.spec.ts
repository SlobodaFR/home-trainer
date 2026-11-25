import { randomUUID } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { InitiateServiceLogoutUseCase } from '../../../application/auth/initiate-service-logout.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { computeWebhookSignature } from '../../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../../domain/shared/feature-flags';
import { WebhookAuthenticator } from '../../../infrastructure/auth/webhook-authenticator';
import { AuthController } from './auth.controller';

const SIGNING_SECRET =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const LEGACY_SECRET = 'legacy-query-secret';

class SwitchableFlags extends FeatureFlags {
  requireSignature = false;
  isEnabled(): Promise<boolean> {
    return Promise.resolve(this.requireSignature);
  }
}

describe('POST /auth/disconnect (HTTP, rawBody as in main.ts)', () => {
  let app: NestExpressApplication;
  const flags = new SwitchableFlags();
  const execute = vi.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              FRONTEND_URL: 'https://trainer.example.test',
              AUTH_WEBHOOK_SECRET: LEGACY_SECRET,
              AUTH_WEBHOOK_SIGNING_SECRET: SIGNING_SECRET,
            }),
          ],
        }),
      ],
      controllers: [AuthController],
      providers: [
        WebhookAuthenticator,
        { provide: FeatureFlags, useValue: flags },
        { provide: HandleSessionRevokedUseCase, useValue: { execute } },
        { provide: HandleOAuthCallbackUseCase, useValue: {} },
        { provide: OAuthClient, useValue: {} },
        { provide: InitiateServiceLogoutUseCase, useValue: {} },
      ],
    }).compile();
    // Same options as main.ts: `rawBody: true` keeps the exact bytes next to the parsed body.
    app = moduleRef.createNestApplication<NestExpressApplication>({
      rawBody: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    flags.requireSignature = false;
    execute.mockClear();
  });

  function send(
    body: string,
    options: {
      secret?: string;
      signWith?: string;
      id?: string;
      timestamp?: number;
      contentType?: string;
    } = {},
  ) {
    const id = options.id ?? randomUUID();
    const timestamp = String(
      options.timestamp ?? Math.floor(Date.now() / 1000),
    );
    const req = request(app.getHttpServer())
      .post(
        options.secret === undefined
          ? '/auth/disconnect'
          : `/auth/disconnect?secret=${options.secret}`,
      )
      .set('Content-Type', options.contentType ?? 'application/json');
    if (options.signWith) {
      req
        .set('X-Auth-Webhook-Id', id)
        .set('X-Auth-Webhook-Timestamp', timestamp)
        .set(
          'X-Auth-Webhook-Signature',
          `v1=${computeWebhookSignature(options.signWith, id, timestamp, body)}`,
        );
    }
    return req.send(body);
  }

  it('accepts a signed webhook and revokes the user', async () => {
    await send('{"userId":"u1"}', { signWith: SIGNING_SECRET }).expect(204);
    expect(execute).toHaveBeenCalledWith('u1');
  });

  it('verifies the exact bytes received, not a re-serialization of the parsed body', async () => {
    // Spaces, escapes and non-ASCII: JSON.stringify(parsed) would give different bytes.
    await send('{ "userId" : "4b8f-\\u00e9-é" }', {
      signWith: SIGNING_SECRET,
      contentType: 'application/json; charset=utf-8',
    }).expect(204);
    expect(execute).toHaveBeenCalledWith('4b8f-é-é');
  });

  it('refuses a bad signature without the legacy secret (401)', async () => {
    await send('{"userId":"u1"}', {
      signWith: '1'.repeat(64),
    }).expect(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a stale timestamp (401)', async () => {
    await send('{"userId":"u1"}', {
      signWith: SIGNING_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 600,
    }).expect(401);
  });

  it('flag off: still accepts the legacy ?secret= alone', async () => {
    await send('{"userId":"u1"}', { secret: LEGACY_SECRET }).expect(204);
    expect(execute).toHaveBeenCalledWith('u1');
  });

  it('refuses a wrong legacy secret and a request with neither (401)', async () => {
    await send('{"userId":"u1"}', { secret: 'wrong' }).expect(401);
    await send('{"userId":"u1"}').expect(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('flag on: refuses the legacy ?secret= (401), accepts a signature', async () => {
    flags.requireSignature = true;
    await send('{"userId":"u1"}', { secret: LEGACY_SECRET }).expect(401);
    await send('{"userId":"u1"}', {
      secret: LEGACY_SECRET,
      signWith: SIGNING_SECRET,
    }).expect(204);
  });

  it('flag on: refuses a replayed id (401)', async () => {
    flags.requireSignature = true;
    const id = randomUUID();
    await send('{"userId":"u1"}', { signWith: SIGNING_SECRET, id }).expect(204);
    await send('{"userId":"u1"}', { signWith: SIGNING_SECRET, id }).expect(401);
  });

  it('flag off: a replayed signed request carrying a valid ?secret= is refused (401)', async () => {
    const id = randomUUID();
    await send('{"userId":"u1"}', { signWith: SIGNING_SECRET, id }).expect(204);
    await send('{"userId":"u1"}', {
      signWith: SIGNING_SECRET,
      id,
      secret: LEGACY_SECRET,
    }).expect(401);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('flag off: a lone already-seen id header with a valid ?secret= is refused (401)', async () => {
    const id = randomUUID();
    await send('{"userId":"u1"}', { signWith: SIGNING_SECRET, id }).expect(204);
    await request(app.getHttpServer())
      .post(`/auth/disconnect?secret=${LEGACY_SECRET}`)
      .set('Content-Type', 'application/json')
      .set('X-Auth-Webhook-Id', id)
      .send('{"userId":"u1"}')
      .expect(401);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('still validates the body (400 without userId)', async () => {
    await send('{}', { signWith: SIGNING_SECRET }).expect(400);
  });
});
