import { createEnvSchema } from './env.schema';

const BASE_ENV = {
  AUTH_SERVICE_URL: 'https://auth.example.test',
  AUTH_CLIENT_ID: 'trainer',
  AUTH_CLIENT_SECRET: 'client-secret',
  AUTH_WEBHOOK_SECRET: 'webhook-secret',
  OPENAI_API_KEY: 'sk-test',
};

function validate(
  env: Record<string, unknown>,
  processEnv: NodeJS.ProcessEnv = {},
) {
  return createEnvSchema(processEnv).validate(env, { allowUnknown: true });
}

describe('environment schema', () => {
  it('accepts the minimal environment (feature flags are optional)', () => {
    const { error, value } = validate(BASE_ENV);
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      DATABASE_PATH: 'data/trainer.sqlite',
      PORT: 3000,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it.each([
    'AUTH_SERVICE_URL',
    'AUTH_CLIENT_ID',
    'AUTH_CLIENT_SECRET',
    'AUTH_WEBHOOK_SECRET',
    'OPENAI_API_KEY',
  ])('still requires %s', (variable) => {
    const env: Record<string, unknown> = { ...BASE_ENV };
    delete env[variable];
    expect(validate(env).error?.message).toContain(variable);
  });

  it('accepts empty feature-flag variables (a blank 1Password field)', () => {
    const { error } = validate({
      ...BASE_ENV,
      FEATURES_OFREP_URL: '',
      FEATURES_API_KEY: '',
    });
    expect(error).toBeUndefined();
  });

  it('never blocks startup on what the feature-flag adapter tolerates', () => {
    // The adapter validates URL and key itself and falls back to code defaults (no-op).
    const { error } = validate({
      ...BASE_ENV,
      FEATURES_OFREP_URL: 'http://not-https.example.test/api',
      FEATURES_API_KEY: 'not-an-hf-key',
    });
    expect(error).toBeUndefined();
  });

  describe('AUTH_WEBHOOK_SIGNING_SECRET (optional, 64 hex)', () => {
    const SECRET =
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

    it('is optional: absent or blank means only the legacy ?secret= path', () => {
      expect(validate(BASE_ENV).error).toBeUndefined();
      expect(
        validate({ ...BASE_ENV, AUTH_WEBHOOK_SIGNING_SECRET: '' }).error,
      ).toBeUndefined();
    });

    it('accepts 64 lower-case hex characters', () => {
      expect(
        validate({ ...BASE_ENV, AUTH_WEBHOOK_SIGNING_SECRET: SECRET }).error,
      ).toBeUndefined();
    });

    it('validates outside production too (development, test)', () => {
      for (const NODE_ENV of ['development', 'test']) {
        expect(
          validate(
            { ...BASE_ENV, AUTH_WEBHOOK_SIGNING_SECRET: SECRET.toUpperCase() },
            { NODE_ENV },
          ).error?.message,
        ).toContain('AUTH_WEBHOOK_SIGNING_SECRET');
      }
    });

    it.each([
      ['too short', SECRET.slice(0, 62)],
      ['too long', `${SECRET}00`],
      ['not hex', 'z'.repeat(64)],
      ['upper-case (home-auth generates lower-case)', SECRET.toUpperCase()],
      ['surrounded by spaces', ` ${SECRET} `],
    ])('refuses a malformed value (%s): startup stops', (_label, value) => {
      expect(
        validate({ ...BASE_ENV, AUTH_WEBHOOK_SIGNING_SECRET: value }).error
          ?.message,
      ).toContain('AUTH_WEBHOOK_SIGNING_SECRET');
    });
  });

  it('keeps PSEUDONYM_SECRET mandatory in production only', () => {
    expect(
      validate(BASE_ENV, { NODE_ENV: 'production' }).error?.message,
    ).toContain('PSEUDONYM_SECRET');
    const development = validate(BASE_ENV, { NODE_ENV: 'development' });
    expect(development.error).toBeUndefined();
    expect(development.value).toMatchObject({
      PSEUDONYM_SECRET: 'dev-only-pseudonym-secret-not-for-production',
    });
    expect(
      validate(
        { ...BASE_ENV, PSEUDONYM_SECRET: 'x'.repeat(32) },
        { NODE_ENV: 'production' },
      ).error,
    ).toBeUndefined();
  });
});
