import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';

interface WgerListResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

interface WgerLanguage {
  id: number;
  short_name: string;
  full_name: string;
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

// Map Wger equipment names → our canonical set (case-insensitive key match)
const EQUIPMENT_MAP: Record<string, string> = {
  'none (bodyweight exercise)': 'Bodyweight',
  elastic: 'Resistance Band',
  'elastic band': 'Resistance Band',
  'resistance band': 'Resistance Band',
  'sz-bar': 'Barbell',
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  'gym mat': 'Bodyweight',
  'pull-up bar': 'Pull-up Bar',
  bench: 'Bench',
  'incline bench': 'Bench',
  'swiss ball': 'Swiss Ball',
};

function normalizeEquipment(name: string): string {
  return EQUIPMENT_MAP[name.toLowerCase()] ?? name;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${String(res.status)}: ${url}`);
  return res.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFrenchLanguageId(): Promise<number | null> {
  const data = await fetchJson<WgerListResponse<WgerLanguage>>(
    `${WGER_BASE}/language/?format=json&limit=100`,
  );
  return data.results.find((l) => l.short_name === 'fr')?.id ?? null;
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
    const withFr = await repo
      .createQueryBuilder('e')
      .where('e.name_fr IS NOT NULL')
      .getCount();
    // Check if bodyweight is properly tagged (as 'Bodyweight', not empty [])
    const withBodyweight = await repo
      .createQueryBuilder('e')
      .where(`e.equipment LIKE '%Bodyweight%'`)
      .getCount();

    if (withImages > 0 && withFr > 0 && withBodyweight > 0) {
      console.log(
        `[wger-seed] ${String(count)} exercises fully seeded — skipping.`,
      );
      await dataSource.destroy();
      return;
    }
    console.log(
      `[wger-seed] ${String(count)} exercises found — updating (missing: ${!withFr ? 'FR' : ''}${!withBodyweight ? ' equipment-mapping' : ''})…`,
    );
  }

  console.log('[wger-seed] Fetching French language ID from Wger…');
  const frenchLanguageId = await getFrenchLanguageId();
  console.log(
    `[wger-seed] French language ID: ${frenchLanguageId !== null ? String(frenchLanguageId) : 'not found'}`,
  );

  let offset = 0;
  let page = 1;
  let totalUpserted = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${WGER_BASE}/exerciseinfo/?format=json&limit=100&offset=${String(offset)}`;
    const data = await fetchJson<WgerListResponse<WgerExerciseInfo>>(url);

    const batch = data.results
      .map((ex) => {
        const enTranslation = ex.translations.find(
          (t) => t.language === ENGLISH_LANGUAGE,
        );
        if (!enTranslation?.name.trim()) return null;

        const frTranslation =
          frenchLanguageId !== null
            ? ex.translations.find((t) => t.language === frenchLanguageId)
            : undefined;

        const entity = new ExerciseOrmEntity();
        entity.wgerId = ex.id;
        entity.name = enTranslation.name.trim();
        entity.description = enTranslation.description;
        entity.nameFr = frTranslation?.name.trim() ?? null;
        entity.descriptionFr = frTranslation?.description ?? null;
        entity.muscleGroups = ex.muscles
          .map((m) => m.name_en)
          .filter((n) => n.length > 0);
        entity.equipment = [
          ...new Set(
            ex.equipment
              .map((e) => normalizeEquipment(e.name))
              .filter((n) => n.length > 0),
          ),
        ];
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
