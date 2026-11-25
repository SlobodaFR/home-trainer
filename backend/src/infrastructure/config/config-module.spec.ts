import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createEnvSchema } from './env.schema';

const REQUIRED = {
  AUTH_SERVICE_URL: 'https://auth.example.test',
  AUTH_CLIENT_ID: 'trainer',
  AUTH_CLIENT_SECRET: 'client-secret',
  AUTH_WEBHOOK_SECRET: 'webhook-secret',
  OPENAI_API_KEY: 'sk-test',
};

// Exercises @nestjs/config 12 -> Joi 18 (Standard Schema) through the real ConfigModule.
function boot() {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        validationSchema: createEnvSchema(process.env),
      }),
    ],
  }).compile();
}

describe('ConfigModule with the real environment schema', () => {
  beforeEach(() => {
    // Isolate from the developer's shell: every key the schema defaults or constrains.
    vi.stubEnv('NODE_ENV', 'test');
    for (const k of [
      'LLM_PROVIDER',
      'TRUST_PROXY_HOPS',
      'AUTH_WEBHOOK_SIGNING_SECRET',
      'PSEUDONYM_SECRET',
      'PORT',
    ]) {
      vi.stubEnv(k, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('boots with a valid environment, applying defaults and coercion', async () => {
    for (const [k, v] of Object.entries(REQUIRED)) vi.stubEnv(k, v);
    vi.stubEnv('PORT', '4321');

    const config = (await boot()).get(ConfigService);

    expect(config.get('PORT')).toBe(4321);
    expect(config.get('LLM_PROVIDER')).toBe('openai');
    expect(config.get('TRUST_PROXY_HOPS')).toBe(0);
  });

  it('fails to boot when a required variable is missing', async () => {
    for (const [k, v] of Object.entries(REQUIRED)) vi.stubEnv(k, v);
    vi.stubEnv('AUTH_CLIENT_SECRET', undefined);

    await expect(boot()).rejects.toThrow(/AUTH_CLIENT_SECRET/);
  });
});
