import * as Joi from 'joi';

// Never used to key production logs: the schema requires a real secret there.
const DEV_PSEUDONYM_SECRET = 'dev-only-pseudonym-secret-not-for-production';

/**
 * Startup validation of the environment (ConfigModule). `env` is only read for NODE_ENV: in
 * production the pseudonymization secret is mandatory.
 */
export function createEnvSchema(env: NodeJS.ProcessEnv): Joi.ObjectSchema {
  return Joi.object({
    DATABASE_PATH: Joi.string().default('data/trainer.sqlite'),
    FRONTEND_URL: Joi.string().default('http://localhost:5173'),
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    AUTH_SERVICE_URL: Joi.string().required(),
    AUTH_CLIENT_ID: Joi.string().required(),
    AUTH_CLIENT_SECRET: Joi.string().required(),
    AUTH_WEBHOOK_SECRET: Joi.string().required(),
    // Logout webhook signature key (home-auth contract PC7): 32 random bytes as 64 hex characters.
    // Absent or blank: only the legacy `?secret=` authenticates the webhook.
    AUTH_WEBHOOK_SIGNING_SECRET: Joi.string()
      .pattern(/^[0-9a-f]{64}$/)
      .allow('')
      .optional(),
    OPENAI_API_KEY: Joi.string().required(),
    LLM_PROVIDER: Joi.string().default('openai'),
    // Keys the HMAC that pseudonymizes personal data in logs: mandatory in production.
    PSEUDONYM_SECRET:
      env.NODE_ENV === 'production'
        ? Joi.string().min(32).required()
        : Joi.string().min(32).default(DEV_PSEUDONYM_SECRET),
    TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
    // home-features (OFREP). Optional and deliberately not checked here: the feature-flag adapter
    // validates URL and key itself and falls back to code defaults, so a wrong value never
    // blocks startup. Blank allowed (an empty 1Password field).
    FEATURES_OFREP_URL: Joi.string().allow('').optional(),
    FEATURES_API_KEY: Joi.string().allow('').optional(),
  });
}
