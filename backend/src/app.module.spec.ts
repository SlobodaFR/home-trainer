import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

describe('AppModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('serializes the transactions of the production connection (convention sqlite-serialized-transactions)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_PATH', ':memory:');
    vi.stubEnv('AUTH_SERVICE_URL', 'http://auth.test');
    vi.stubEnv('AUTH_CLIENT_ID', 'home-trainer');
    vi.stubEnv('AUTH_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('AUTH_WEBHOOK_SECRET', 'legacy');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    // Imported after the stubs: the module reads process.env when it is evaluated.
    const { AppModule } = await import('./app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    const dataSource = moduleRef.get(DataSource);

    // TypeORM's own better-sqlite3 driver returns one shared runner for every caller.
    expect(dataSource.createQueryRunner()).not.toBe(
      dataSource.createQueryRunner(),
    );

    await moduleRef.close();
  });
});
