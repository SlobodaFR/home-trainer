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
