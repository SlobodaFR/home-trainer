import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { MIGRATIONS } from '../infrastructure/persistence/migrations';
import { createSeedDataSource } from './wger-seed';

const sqliteMaster = (ds: DataSource) =>
  ds.query(
    `SELECT type, name, sql FROM sqlite_master
     WHERE name NOT IN ('migrations', 'sqlite_sequence') ORDER BY type, name`,
  );

describe('createSeedDataSource', () => {
  it('builds the schema through the migrations, never synchronize', async () => {
    const ds = createSeedDataSource(':memory:');
    await ds.initialize();

    expect(ds.options.synchronize).toBe(false);
    expect(await ds.query('SELECT name FROM migrations')).toEqual(
      MIGRATIONS.map((migration) => ({ name: migration.name })),
    );
    // Same schema as the application's: the seed can write exercises into it.
    expect((await ds.driver.createSchemaBuilder().log()).upQueries).toEqual([]);
    await ds.destroy();
  });

  it('leaves a database already migrated by the application untouched', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'seed-')), 'trainer.sqlite');
    const first = createSeedDataSource(file);
    await first.initialize();
    await first.query(
      "INSERT INTO exercises (id, name) VALUES ('e1', 'Squat')",
    );
    const schema = await sqliteMaster(first);
    await first.destroy();

    const second = createSeedDataSource(file);
    await second.initialize();

    expect(await sqliteMaster(second)).toEqual(schema);
    expect(await second.query('SELECT id FROM exercises')).toEqual([
      { id: 'e1' },
    ]);
    await second.destroy();
  });
});
