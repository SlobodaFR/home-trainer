import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';

interface WgerListResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

interface WgerMuscle {
  id: number;
  name_en: string;
}

interface WgerEquipment {
  id: number;
  name: string;
}

interface WgerExercise {
  id: number;
  name: string;
  description: string;
  muscles: number[];
  equipment: number[];
  language: number;
}

const WGER_BASE = 'https://wger.de/api/v2';
const ENGLISH_LANGUAGE = 2;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${String(res.status)}: ${url}`);
  return res.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildMuscleMap(): Promise<Map<number, string>> {
  const data = await fetchJson<WgerListResponse<WgerMuscle>>(
    `${WGER_BASE}/muscle/?format=json&limit=100`,
  );
  return new Map(data.results.map((m) => [m.id, m.name_en]));
}

async function buildEquipmentMap(): Promise<Map<number, string>> {
  const data = await fetchJson<WgerListResponse<WgerEquipment>>(
    `${WGER_BASE}/equipment/?format=json&limit=100`,
  );
  return new Map(data.results.map((e) => [e.id, e.name]));
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH ?? 'data/trainer.sqlite',
    entities: [ExerciseOrmEntity],
    synchronize: false,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(ExerciseOrmEntity);

  const count = await repo.count();
  if (count > 0) {
    console.log(
      `[wger-seed] ${String(count)} exercises already present — skipping.`,
    );
    await dataSource.destroy();
    return;
  }

  console.log('[wger-seed] Fetching muscle and equipment maps…');
  const [muscleMap, equipmentMap] = await Promise.all([
    buildMuscleMap(),
    buildEquipmentMap(),
  ]);
  console.log(
    `[wger-seed] ${String(muscleMap.size)} muscles, ${String(equipmentMap.size)} equipment items`,
  );

  let offset = 0;
  let page = 1;
  let totalUpserted = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${WGER_BASE}/exercise/?format=json&language=${String(ENGLISH_LANGUAGE)}&limit=100&offset=${String(offset)}`;
    const data = await fetchJson<WgerListResponse<WgerExercise>>(url);

    const batch = data.results
      .filter((ex) => ex.name.trim().length > 0)
      .map((ex) => {
        const entity = new ExerciseOrmEntity();
        entity.wgerId = ex.id;
        entity.name = ex.name.trim();
        entity.description = ex.description;
        entity.muscleGroups = ex.muscles
          .map((id) => muscleMap.get(id))
          .filter((name): name is string => name !== undefined);
        entity.equipment = ex.equipment
          .map((id) => equipmentMap.get(id))
          .filter((name): name is string => name !== undefined);
        entity.youtubeUrl = null;
        entity.everkineticSlug = null;
        return entity;
      });

    if (batch.length > 0) {
      await repo.upsert(batch, {
        conflictPaths: ['wgerId'],
        skipUpdateIfNoValuesChanged: true,
      });
      totalUpserted += batch.length;
    }

    console.log(
      `[wger-seed] page ${String(page)} — upserted ${String(batch.length)} exercises`,
    );

    hasMore = data.next !== null;
    offset += 100;
    page += 1;
    if (hasMore) await sleep(500);
  }

  console.log(`[wger-seed] Done. Total upserted: ${String(totalUpserted)}`);
  await dataSource.destroy();
}

main().catch((err: unknown) => {
  console.error('[wger-seed] Error:', err);
  process.exit(1);
});
