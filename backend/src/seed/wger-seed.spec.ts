import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';
import { runSeed } from './wger-seed';

function exo(id: number, name: string) {
  return {
    id,
    muscles: [],
    muscles_secondary: [],
    equipment: [{ id: 1, name: 'none (bodyweight exercise)' }],
    translations: [
      { id, language: 2, name, description: 'd' },
      { id: id + 1000, language: 12, name: `${name} FR`, description: 'd' },
    ],
    images: [
      {
        id,
        image: `https://x/${String(id)}.png`,
        is_main: true,
        thumbnails: { small: '', medium: '' },
      },
    ],
  };
}

function json(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve(body),
  } as Response;
}

const LANGS = {
  count: 1,
  next: null,
  results: [{ id: 12, short_name: 'fr', full_name: 'Français' }],
};

describe('runSeed', () => {
  let ds: DataSource;
  const fast = { pageDelayMs: 0, requestTimeoutMs: 200, totalTimeoutMs: 2000 };

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ExerciseOrmEntity],
      synchronize: true,
    });
    await ds.initialize();
  });
  afterEach(async () => {
    await ds.destroy();
    vi.restoreAllMocks();
  });

  const count = () => ds.getRepository(ExerciseOrmEntity).count();

  it('seeds every page then reports seeded', async () => {
    const fetchImpl = vi.fn((u: string) => {
      if (u.includes('/language/')) return Promise.resolve(json(LANGS));
      return Promise.resolve(
        u.includes('offset=0')
          ? json({ count: 2, next: 'n', results: [exo(1, 'A')] })
          : json({ count: 2, next: null, results: [exo(2, 'B')] }),
      );
    });
    expect(await runSeed(ds, { ...fast, fetchImpl })).toBe('seeded');
    expect(await count()).toBe(2);
  });

  it('skips without any network call when already fully seeded', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json(LANGS)));
    await runSeed(ds, {
      ...fast,
      fetchImpl: (u) =>
        Promise.resolve(
          u.includes('/language/')
            ? json(LANGS)
            : json({ count: 1, next: null, results: [exo(1, 'A')] }),
        ),
    });
    expect(await runSeed(ds, { ...fast, fetchImpl })).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('writes nothing when a later page fails (no half-seeded DB)', async () => {
    const fetchImpl = vi.fn((u: string) => {
      if (u.includes('/language/')) return Promise.resolve(json(LANGS));
      return Promise.resolve(
        u.includes('offset=0')
          ? json({ count: 2, next: 'n', results: [exo(1, 'A')] })
          : json({}, false),
      );
    });
    await expect(runSeed(ds, { ...fast, fetchImpl })).rejects.toThrow(/503/);
    expect(await count()).toBe(0);
  });

  it('aborts a hanging request within the request timeout', async () => {
    const fetchImpl = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener('abort', () => {
            rej(new Error('aborted'));
          });
        }),
    );
    const started = Date.now();
    await expect(runSeed(ds, { ...fast, fetchImpl })).rejects.toThrow(
      /aborted/,
    );
    expect(Date.now() - started).toBeLessThan(1500);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('enforces the total deadline across pages', async () => {
    const fetchImpl = vi.fn((u: string) =>
      Promise.resolve(
        u.includes('/language/')
          ? json(LANGS)
          : json({ count: 9, next: 'n', results: [exo(1, 'A')] }),
      ),
    );
    await expect(
      runSeed(ds, { ...fast, totalTimeoutMs: 50, pageDelayMs: 30, fetchImpl }),
    ).rejects.toThrow(/total timeout/);
    expect(await count()).toBe(0);
  });
});
