import { mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';
import { InitialSchema1795800000000 } from './migrations/1795800000000-InitialSchema';

function dataSource(database: string, synchronize = false): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize,
  });
}

const tempFile = (name: string) =>
  join(mkdtempSync(join(tmpdir(), 'db-')), name);

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

// `migrations` (and sqlite_sequence, created by its AUTOINCREMENT key) only exist with migrations.
const schemaOf = (ds: DataSource): Promise<MasterRow[]> =>
  ds.query(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE tbl_name NOT IN ('migrations', 'sqlite_sequence') ORDER BY type, name`,
  );

const SAMPLE_ROWS = [
  "INSERT INTO users (id, email, name, avatar_url) VALUES ('u1', 'a@example.com', 'Alice', 'http://a'), ('u2', 'b@example.com', 'Bob', 'http://b')",
  "INSERT INTO revoked_sessions (user_id, revoked_at) VALUES ('u1', '2026-01-01 00:00:00')",
  "INSERT INTO exercises (id, wger_id, name, description, muscle_groups, equipment, image_url, muscle_images, youtube_url, everkinetic_slug, name_fr, description_fr) VALUES ('e1', 1, 'Squat', 'd', '[\"legs\"]', '[]', 'http://i', '[]', NULL, 'squat', 'Squat FR', 'd fr'), ('e2', NULL, 'Pompe', '', '[]', '[]', NULL, '[]', NULL, NULL, NULL, NULL)",
  "INSERT INTO user_exercises (user_id, exercise_id, is_favorite, preference_weight) VALUES ('u1', 'e1', 1, 3)",
  "INSERT INTO goals (id, user_id, type, target_description, horizon_weeks, availability_days, session_duration_minutes, available_equipment, active_from, is_active) VALUES ('g1', 'u1', 'strength', 't', 8, '[1,3]', 45, '[]', '2026-07-06', 1)",
  "INSERT INTO sessions (id, user_id, goal_id, planned_date, status, rpe, note) VALUES ('s1', 'u1', 'g1', '2026-07-07', 'done', 7, 'ok'), ('s2', 'u1', 'g1', '2026-07-09', 'planned', NULL, NULL)",
  "INSERT INTO session_exercises (id, session_id, exercise_id, exercise_name, \"order\", sets, reps_or_duration) VALUES ('se1', 's1', 'e1', 'Squat', 1, 3, '10')",
  "INSERT INTO workout_logs (id, session_id, session_exercise_id, user_id, set_number, reps_completed, weight_kg, duration_seconds) VALUES ('w1', 's1', 'se1', 'u1', 1, 10, 60.5, NULL)",
  "INSERT INTO session_analyses (id, session_id, user_id, status, result, retry_count) VALUES ('a1', 's1', 'u1', 'done', '{\"x\":1}', 1)",
  "INSERT INTO user_fitness_profiles (id, user_id, level, injury_notes, equipment_comfort_list, specific_goal, summary, planner_config) VALUES ('p1', 'u1', 'beginner', '-', '[]', 'g', 's', '{}')",
];
const TABLES = [
  'users',
  'revoked_sessions',
  'exercises',
  'user_exercises',
  'goals',
  'sessions',
  'session_exercises',
  'workout_logs',
  'session_analyses',
  'user_fitness_profiles',
];

async function dumpRows(ds: DataSource): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    out[table] = await ds.query(`SELECT * FROM "${table}" ORDER BY 1`);
  }
  return out;
}

describe('database migrations', () => {
  // Any entity change without its migration makes this fail.
  it('produce exactly the schema the entities describe', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();

    const pending = await ds.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
    await ds.destroy();
  });

  it('create the same sqlite_master as synchronize does (apart from the migrations table)', async () => {
    const synced = dataSource(':memory:', true);
    await synced.initialize();
    const migrated = dataSource(':memory:');
    await migrated.initialize();
    await migrated.runMigrations();

    expect(await schemaOf(migrated)).toEqual(await schemaOf(synced));
    await synced.destroy();
    await migrated.destroy();
  });

  // Production was created by synchronize: true; the first migration must adopt it untouched.
  it('adopt a database created by synchronize without losing data', async () => {
    const file = tempFile('prod.sqlite');
    const legacy = dataSource(file, true);
    await legacy.initialize();
    for (const sql of SAMPLE_ROWS) await legacy.query(sql);
    const rowsBefore = await dumpRows(legacy);
    const schemaBefore = await schemaOf(legacy);
    await legacy.destroy();

    const migrated = dataSource(file);
    await migrated.initialize();
    const applied = await migrated.runMigrations();

    expect(applied.map((migration) => migration.name)).toEqual(
      MIGRATIONS.map((migration) => migration.name),
    );
    expect(await dumpRows(migrated)).toEqual(rowsBefore);
    expect(await schemaOf(migrated)).toEqual(schemaBefore);
    expect(await migrated.query('SELECT name FROM migrations')).toEqual([
      { name: 'InitialSchema1795800000000' },
    ]);
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toEqual([]);
    expect(await migrated.query('PRAGMA integrity_check')).toEqual([
      { integrity_check: 'ok' },
    ]);
    await migrated.destroy();
  });

  // Production's exercises and sessions tables got their later columns appended by successive
  // synchronize runs (rpe/note, image_url/muscle_images/name_fr/...): the column order differs
  // from a fresh synchronize. The migration must adopt that order untouched.
  it('adopt tables whose columns are in the historical order', async () => {
    const file = tempFile('prod.sqlite');
    const legacy = dataSource(file, true);
    await legacy.initialize();
    await legacy.query('PRAGMA foreign_keys = OFF');
    await legacy.query('DROP TABLE exercises');
    await legacy.query(
      `CREATE TABLE "exercises" ("id" varchar PRIMARY KEY NOT NULL, "wger_id" integer, "name" text NOT NULL, "description" text NOT NULL DEFAULT (''), "muscle_groups" text NOT NULL DEFAULT ('[]'), "equipment" text NOT NULL DEFAULT ('[]'), "youtube_url" text, "everkinetic_slug" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "image_url" text, "muscle_images" text NOT NULL DEFAULT ('[]'), "name_fr" text, "description_fr" text, CONSTRAINT "UQ_c29ecf4f39ac8736817deb8b9b4" UNIQUE ("wger_id"), CONSTRAINT "UQ_a521b5cac5648eedc036e17d1bd" UNIQUE ("name"))`,
    );
    await legacy.query('DROP TABLE session_exercises');
    await legacy.query('DROP TABLE sessions');
    await legacy.query(
      `CREATE TABLE "sessions" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "goal_id" text NOT NULL, "planned_date" text NOT NULL, "status" text NOT NULL DEFAULT ('planned'), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "rpe" integer, "note" text)`,
    );
    await legacy.query(
      `CREATE TABLE "session_exercises" ("id" varchar PRIMARY KEY NOT NULL, "session_id" varchar NOT NULL, "exercise_id" text NOT NULL, "exercise_name" text NOT NULL, "order" integer NOT NULL, "sets" integer NOT NULL, "reps_or_duration" text NOT NULL, CONSTRAINT "FK_47971b32e655e6072fb1d0abba1" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    for (const sql of SAMPLE_ROWS) await legacy.query(sql);
    const rowsBefore = await dumpRows(legacy);
    const schemaBefore = await schemaOf(legacy);
    await legacy.destroy();

    const migrated = dataSource(file);
    await migrated.initialize();
    await migrated.runMigrations();

    expect(await dumpRows(migrated)).toEqual(rowsBefore);
    expect(await schemaOf(migrated)).toEqual(schemaBefore);
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toEqual([]);
    await migrated.destroy();
  });

  it('keep the unique constraints', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();
    const insert = (id: string, name: string) =>
      ds.query(`INSERT INTO exercises (id, name) VALUES ('${id}', '${name}')`);
    await insert('e1', 'Squat');

    await expect(insert('e2', 'Squat')).rejects.toThrow(/UNIQUE/);
    await ds.destroy();
  });

  it('make the initial migration a no-op when it runs again', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();
    const before = await schemaOf(ds);

    const queryRunner = ds.createQueryRunner();
    await new InitialSchema1795800000000().up(queryRunner);
    await queryRunner.release();

    expect(await schemaOf(ds)).toEqual(before);
    await ds.destroy();
  });

  // forFeature() with an entity missing from ENTITIES would fail at boot with "No metadata".
  it('list every @Entity file of the entities folder in ENTITIES', async () => {
    const dir = join(__dirname, 'entities');
    const declared = readdirSync(dir)
      .filter((file) => file.endsWith('.orm-entity.ts'))
      .map(
        (file) =>
          /@Entity\(\{ name: '(\w+)' \}\)/.exec(
            readFileSync(join(dir, file), 'utf8'),
          )?.[1],
      ) as string[];
    const ds = dataSource(':memory:');
    await ds.initialize();

    const byName = (a: string, b: string) => a.localeCompare(b);
    expect(
      ds.entityMetadatas.map((meta) => meta.tableName).sort(byName),
    ).toEqual(declared.sort(byName));
    await ds.destroy();
  });
});
