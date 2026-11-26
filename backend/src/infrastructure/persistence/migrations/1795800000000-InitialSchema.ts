import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema as created by `synchronize: true` until now. IF NOT EXISTS everywhere: on the existing
 * production database this migration changes nothing and only records itself; on an empty
 * database it creates the schema. Hand-written: raw `migration:generate` output (no IF NOT
 * EXISTS) would crash on the production database.
 *
 * The trailing space after the index column lists is what TypeORM writes: kept so sqlite_master
 * is byte-identical to a synchronize-built database.
 *
 * Only ever use the `queryRunner` passed in (never `dataSource.query`): migrations run on the
 * serialized connection. There is deliberately no CLI data source, and `down()` refuses to run: it would drop the data.
 */
export class InitialSchema1795800000000 implements MigrationInterface {
  name = 'InitialSchema1795800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "exercises" ("id" varchar PRIMARY KEY NOT NULL, "wger_id" integer, "name" text NOT NULL, "description" text NOT NULL DEFAULT (''), "muscle_groups" text NOT NULL DEFAULT ('[]'), "equipment" text NOT NULL DEFAULT ('[]'), "image_url" text, "muscle_images" text NOT NULL DEFAULT ('[]'), "youtube_url" text, "everkinetic_slug" text, "name_fr" text, "description_fr" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_c29ecf4f39ac8736817deb8b9b4" UNIQUE ("wger_id"), CONSTRAINT "UQ_a521b5cac5648eedc036e17d1bd" UNIQUE ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "goals" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "type" text NOT NULL, "target_description" text NOT NULL, "horizon_weeks" integer NOT NULL, "availability_days" text NOT NULL, "session_duration_minutes" integer NOT NULL, "available_equipment" text NOT NULL, "active_from" text NOT NULL, "is_active" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "revoked_sessions" ("user_id" text PRIMARY KEY NOT NULL, "revoked_at" datetime NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "session_analyses" ("id" varchar PRIMARY KEY NOT NULL, "session_id" text NOT NULL, "user_id" text NOT NULL, "status" text NOT NULL DEFAULT ('pending'), "result" text, "retry_count" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_109aa27a377b049a0594ded0f11" UNIQUE ("session_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "session_exercises" ("id" varchar PRIMARY KEY NOT NULL, "session_id" varchar NOT NULL, "exercise_id" text NOT NULL, "exercise_name" text NOT NULL, "order" integer NOT NULL, "sets" integer NOT NULL, "reps_or_duration" text NOT NULL, CONSTRAINT "FK_47971b32e655e6072fb1d0abba1" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "sessions" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "goal_id" text NOT NULL, "planned_date" text NOT NULL, "status" text NOT NULL DEFAULT ('planned'), "rpe" integer, "note" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user_exercises" ("user_id" text NOT NULL, "exercise_id" text NOT NULL, "is_favorite" integer NOT NULL DEFAULT (0), "preference_weight" integer, PRIMARY KEY ("user_id", "exercise_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user_fitness_profiles" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "level" text NOT NULL, "injury_notes" text NOT NULL, "equipment_comfort_list" text NOT NULL, "specific_goal" text NOT NULL, "summary" text NOT NULL, "planner_config" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_be84debd0312b996b25c7206f71" UNIQUE ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" text PRIMARY KEY NOT NULL, "email" text NOT NULL, "name" text NOT NULL, "avatar_url" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workout_logs" ("id" varchar PRIMARY KEY NOT NULL, "session_id" text NOT NULL, "session_exercise_id" text NOT NULL, "user_id" text NOT NULL, "set_number" integer NOT NULL, "reps_completed" integer, "weight_kg" real, "duration_seconds" integer, "completed_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
  }

  // Reverting the baseline would drop every table, and the data with them.
  down(): Promise<void> {
    return Promise.reject(
      new Error('baseline migration: revert not supported, restore a backup'),
    );
  }
}
