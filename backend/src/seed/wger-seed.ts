import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';

interface WgerListResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

interface WgerTranslation {
  id: number;
  language: number;
  name: string;
  description: string;
}

interface WgerMuscleObj {
  id: number;
  name_en: string;
  is_front: boolean;
  image_url_main: string;
}

interface WgerEquipmentObj {
  id: number;
  name: string;
}

interface WgerExerciseImage {
  id: number;
  image: string;
  is_main: boolean;
  thumbnails: { small: string; medium: string };
}

interface WgerExerciseInfo {
  id: number;
  muscles: WgerMuscleObj[];
  muscles_secondary: WgerMuscleObj[];
  equipment: WgerEquipmentObj[];
  translations: WgerTranslation[];
  images: WgerExerciseImage[];
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

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH ?? 'data/trainer.sqlite',
    entities: [ExerciseOrmEntity],
    synchronize: true,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(ExerciseOrmEntity);

  const count = await repo.count();
  if (count > 0) {
    const withImages = await repo
      .createQueryBuilder('e')
      .where('e.image_url IS NOT NULL')
      .getCount();
    if (withImages > 0) {
      console.log(
        `[wger-seed] ${String(count)} exercises with images — skipping.`,
      );
      await dataSource.destroy();
      return;
    }
    console.log(
      `[wger-seed] ${String(count)} exercises found but no images — updating…`,
    );
  }

  let offset = 0;
  let page = 1;
  let totalUpserted = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${WGER_BASE}/exerciseinfo/?format=json&limit=100&offset=${String(offset)}`;
    const data = await fetchJson<WgerListResponse<WgerExerciseInfo>>(url);

    const batch = data.results
      .map((ex) => {
        const translation = ex.translations.find(
          (t) => t.language === ENGLISH_LANGUAGE,
        );
        if (!translation?.name.trim()) return null;

        const entity = new ExerciseOrmEntity();
        entity.wgerId = ex.id;
        entity.name = translation.name.trim();
        entity.description = translation.description;
        entity.muscleGroups = ex.muscles
          .map((m) => m.name_en)
          .filter((n) => n.length > 0);
        entity.equipment = ex.equipment
          .map((e) => e.name)
          .filter((n) => n.length > 0 && n !== 'none (bodyweight exercise)');
        entity.imageUrl = ex.images.find((img) => img.is_main)?.image ?? null;
        entity.muscleImages = [
          ...ex.muscles.map((m) => ({
            url: m.image_url_main,
            isFront: m.is_front,
            isSecondary: false,
          })),
          ...ex.muscles_secondary.map((m) => ({
            url: m.image_url_main,
            isFront: m.is_front,
            isSecondary: true,
          })),
        ];
        entity.youtubeUrl = null;
        entity.everkineticSlug = null;
        return entity;
      })
      .filter((e): e is ExerciseOrmEntity => e !== null);

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
