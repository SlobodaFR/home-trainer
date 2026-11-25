import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
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

export interface SeedOptions {
  /** Délai max par appel HTTP (ms). */
  requestTimeoutMs: number;
  /** Délai max pour toute la récupération Wger (ms) : le seed est sur le chemin de démarrage. */
  totalTimeoutMs: number;
  /** Pause entre deux pages (ms). */
  pageDelayMs: number;
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
}

export const DEFAULT_SEED_OPTIONS: SeedOptions = {
  requestTimeoutMs: 10_000,
  totalTimeoutMs: 45_000,
  pageDelayMs: 500,
  fetchImpl: (url, init) => fetch(url, init),
};

export type SeedOutcome = 'skipped' | 'seeded';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(
  url: string,
  opts: SeedOptions,
  deadline: number,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error(`Wger total timeout exceeded: ${url}`);
  const res = await opts.fetchImpl(url, {
    signal: AbortSignal.timeout(Math.min(opts.requestTimeoutMs, remaining)),
  });
  if (!res.ok) throw new Error(`Fetch failed ${String(res.status)}: ${url}`);
  return res.json() as Promise<T>;
}

async function getFrenchLanguageId(
  opts: SeedOptions,
  deadline: number,
): Promise<number | null> {
  const data = await fetchJson<WgerListResponse<WgerLanguage>>(
    `${WGER_BASE}/language/?format=json&limit=100`,
    opts,
    deadline,
  );
  return data.results.find((l) => l.short_name === 'fr')?.id ?? null;
}

function toEntities(
  results: WgerExerciseInfo[],
  frenchLanguageId: number | null,
): ExerciseOrmEntity[] {
  return results
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
}

async function isFullySeeded(repo: Repository<ExerciseOrmEntity>) {
  const count = await repo.count();
  if (count === 0) return { count, full: false };
  const has = (where: string) =>
    repo
      .createQueryBuilder('e')
      .where(where)
      .getCount()
      .then((n) => n > 0);
  const full =
    (await has('e.image_url IS NOT NULL')) &&
    (await has('e.name_fr IS NOT NULL')) &&
    // Bodyweight correctement étiqueté ('Bodyweight', pas [] vide)
    (await has(`e.equipment LIKE '%Bodyweight%'`));
  return { count, full };
}

/**
 * Remplit le catalogue d'exercices depuis Wger.
 *
 * Tout-ou-rien : toutes les pages sont d'abord récupérées en mémoire (bornées par des délais), puis
 * écrites dans UNE transaction. Un échec réseau en cours de route n'écrit donc rien : la base n'est
 * jamais « à moitié remplie » puis jugée peuplée, et le prochain démarrage réessaie.
 */
export async function runSeed(
  dataSource: DataSource,
  options: Partial<SeedOptions> = {},
): Promise<SeedOutcome> {
  const opts = { ...DEFAULT_SEED_OPTIONS, ...options };
  const repo = dataSource.getRepository(ExerciseOrmEntity);

  const { count, full } = await isFullySeeded(repo);
  if (full) {
    console.log(
      `[wger-seed] ${String(count)} exercises fully seeded — skipping.`,
    );
    return 'skipped';
  }
  if (count > 0) {
    console.log(`[wger-seed] ${String(count)} exercises found — updating…`);
  }

  const deadline = Date.now() + opts.totalTimeoutMs;
  console.log('[wger-seed] Fetching French language ID from Wger…');
  const frenchLanguageId = await getFrenchLanguageId(opts, deadline);
  console.log(
    `[wger-seed] French language ID: ${frenchLanguageId !== null ? String(frenchLanguageId) : 'not found'}`,
  );

  const entities: ExerciseOrmEntity[] = [];
  let offset = 0;
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `${WGER_BASE}/exerciseinfo/?format=json&limit=100&offset=${String(offset)}`;
    const data = await fetchJson<WgerListResponse<WgerExerciseInfo>>(
      url,
      opts,
      deadline,
    );
    const batch = toEntities(data.results, frenchLanguageId);
    entities.push(...batch);
    console.log(
      `[wger-seed] page ${String(page)} — fetched ${String(batch.length)} exercises`,
    );
    hasMore = data.next !== null;
    offset += 100;
    page += 1;
    if (hasMore) await sleep(opts.pageDelayMs);
  }

  await dataSource.transaction(async (manager) => {
    const txRepo = manager.getRepository(ExerciseOrmEntity);
    for (let i = 0; i < entities.length; i += 100) {
      await txRepo.upsert(entities.slice(i, i + 100), {
        conflictPaths: ['wgerId'],
        skipUpdateIfNoValuesChanged: true,
      });
    }
  });

  console.log(`[wger-seed] Done. Total upserted: ${String(entities.length)}`);
  return 'seeded';
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH ?? 'data/trainer.sqlite',
    entities: [ExerciseOrmEntity],
    synchronize: true,
  });
  await dataSource.initialize();
  try {
    await runSeed(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('[wger-seed] Error:', err);
    process.exit(1);
  });
}
