import 'reflect-metadata';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { ENTITIES } from '../infrastructure/persistence/entities';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';
import { MIGRATIONS } from '../infrastructure/persistence/migrations';
import { serializeConnection } from '../infrastructure/persistence/serialized-connection';

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
  /** Délai max pour toute la récupération Wger (ms), attentes de nouvelle tentative comprises. */
  totalTimeoutMs: number;
  /** Pause entre deux pages (ms). */
  pageDelayMs: number;
  /** En dessous de ce nombre d'exercices Wger, la base est jugée incomplète et re-semée. */
  minCompleteCount: number;
  /** Délai de base du backoff exponentiel entre deux tentatives (ms). */
  retryBaseDelayMs: number;
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
}

export const DEFAULT_SEED_OPTIONS: SeedOptions = {
  requestTimeoutMs: 10_000,
  totalTimeoutMs: 45_000,
  pageDelayMs: 500,
  minCompleteCount: 500,
  retryBaseDelayMs: 500,
  fetchImpl: (url, init) => fetch(url, init),
};

export type SeedOutcome = 'skipped' | 'seeded';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_ATTEMPTS = 3;

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Retry-After : secondes entières ou date HTTP ; null si absent ou illisible. */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get('retry-after');
  if (raw === null) return null;
  const seconds = Number(raw);
  if (raw.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const date = Date.parse(raw);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

async function fetchJson<T>(
  url: string,
  opts: SeedOptions,
  deadline: number,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`Wger total timeout exceeded: ${url}`);
    const res = await opts.fetchImpl(url, {
      signal: AbortSignal.timeout(Math.min(opts.requestTimeoutMs, remaining)),
    });
    if (res.ok) return res.json() as Promise<T>;
    const failure = new Error(`Fetch failed ${String(res.status)}: ${url}`);
    if (!isRetryable(res.status) || attempt >= MAX_ATTEMPTS) throw failure;
    const wait =
      retryAfterMs(res) ?? opts.retryBaseDelayMs * 2 ** (attempt - 1);
    // Attendre plus que le délai global restant ne servirait à rien : abandon immédiat.
    if (wait >= deadline - Date.now()) throw failure;
    console.warn(
      `[wger-seed] ${String(res.status)} — retry ${String(attempt)}/${String(MAX_ATTEMPTS - 1)} in ${String(wait)} ms`,
    );
    await sleep(wait);
  }
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

async function isFullySeeded(
  repo: Repository<ExerciseOrmEntity>,
  minCompleteCount: number,
) {
  // Seules les lignes Wger comptent : un exercice créé par l'utilisateur ne rend pas le catalogue complet.
  const count = await repo.count({ where: { wgerId: Not(IsNull()) } });
  // Seuil de complétude : une base laissée à moitié remplie par l'ancien seed (page par page) est re-semée.
  if (count < minCompleteCount) return { count, full: false };
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

  const { count, full } = await isFullySeeded(repo, opts.minCompleteCount);
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

/**
 * Same entities and migrations as the application (never `synchronize`): the seed creates or adopts
 * the schema through the reviewed migrations, so it can never rebuild a table on its own.
 */
export function createSeedDataSource(database: string): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    synchronize: false,
    migrations: MIGRATIONS,
    migrationsRun: true,
  });
}

async function main(): Promise<void> {
  const dataSource = createSeedDataSource(
    process.env.DATABASE_PATH ?? 'data/trainer.sqlite',
  );
  serializeConnection(dataSource);
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
