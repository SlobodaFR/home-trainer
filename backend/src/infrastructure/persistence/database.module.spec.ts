import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { DatabaseModule } from './database.module';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

const boot = (database: string) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ DATABASE_PATH: database })],
      }),
      DatabaseModule,
    ],
  })
    .compile()
    .then((moduleRef) => moduleRef.createNestApplication());

describe('DatabaseModule (production wiring)', () => {
  it('boots on an empty database and migrates it', async () => {
    const app = await boot(':memory:');
    await expect(app.init()).resolves.toBeDefined();
    await app.close();
  });

  it('refuses to boot when the migrated database has drifted (SchemaGuard is wired)', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'drift.sqlite');
    const setup = new DataSource({
      type: 'better-sqlite3',
      database: file,
      entities: ENTITIES,
      migrations: MIGRATIONS,
    });
    await setup.initialize();
    await setup.runMigrations();
    await setup.query('DROP INDEX "IDX_97672ac88f789774dd47f7c8be"');
    await setup.destroy();

    const app = await boot(file);
    await expect(app.init()).rejects.toThrow(/differs from the entities/);
    await app.close();
  });
});
