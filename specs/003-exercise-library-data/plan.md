# Plan: Exercise Library — Data Layer

**Spec**: specs/003-exercise-library-data/spec.md

## Architecture Decisions

### AD-1: Native PostgreSQL `text[]` for muscleGroups + equipment

- **Choice**: `@Column({ type: 'text', array: true })` — maps to PostgreSQL `text[]`; query with `= ANY(column)` in QueryBuilder
- **Rationale**: Array containment queries are clean and idiomatic in PostgreSQL; TypeORM supports them natively with `synchronize: true`; avoids join-table overhead for a read-only catalog
- **Alternatives considered**: `simple-array` (comma-separated TEXT) — doesn't support native `= ANY()`; normalized join table — overkill for a read-only single-user catalog

### AD-2: Standalone ts-node seed script (no NestJS bootstrap)

- **Choice**: `backend/src/seed/wger-seed.ts` creates a bare `TypeORM DataSource` directly; invoked via `ts-node -r tsconfig-paths/register`
- **Rationale**: No full NestJS app startup needed for a one-shot import; `ts-node` + `tsconfig-paths` already in devDeps; simpler, faster, fewer failure modes
- **Alternatives considered**: NestJS CLI command — adds `@nestjs/command` dep and more boilerplate; `nest start --entryFile` — spins up full app including `JwtAuthGuard` registration, unnecessary

### AD-3: Upsert via wger_id as natural key

- **Choice**: `dataSource.getRepository(ExerciseOrmEntity).upsert(exercises, ['wgerId'])` — conflict on `wger_id`; updates all columns on conflict
- **Rationale**: Safe to re-run (idempotent); `wger_id` is stable across Wger API runs for the same exercise; TypeORM `upsert()` maps to `INSERT ... ON CONFLICT DO UPDATE`
- **Alternatives considered**: Delete + re-insert — loses manually set `youtube_url` / `everkinetic_slug`; check-then-insert — N queries per exercise, slow

### AD-4: Application use cases for query logic

- **Choice**: `GetExercisesUseCase` + `GetExerciseByIdUseCase` following the auth pattern (injectable, testable, repository-abstracted)
- **Rationale**: Consistent with project architecture; keeps controller thin; repository mock enables unit tests without DB
- **Alternatives considered**: Query directly in controller — violates clean architecture; query directly in repository — leaks business logic

### AD-5: Everkinetic SVGs bundled at build time, slug mapping deferred

- **Choice**: Copy a curated subset of Everkinetic SVGs to `frontend/public/everkinetic/`; `everkinetic_slug` column added but left null for all seeded exercises
- **Rationale**: F-003 is the data layer — the slug→SVG mapping is a UI concern (visual matching, fallback handling) owned by F-004. Adding it here adds no value until F-004 exists. SVGs are static assets, zero runtime cost.
- **Alternatives considered**: Auto-map Wger exercise names to Everkinetic slugs — requires fuzzy matching or a manual lookup table; deferred to F-004

## Affected Files

### New Files

| File                                                                                 | Purpose                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `backend/src/domain/exercise/exercise.ts`                                            | Domain model: `{ id, wgerId, name, description, muscleGroups, equipment, youtubeUrl, everkineticSlug, createdAt }` |
| `backend/src/domain/exercise/exercise.repository.ts`                                 | Abstract: `findAll(params)`, `findById(id)`                                                                        |
| `backend/src/application/exercise/get-exercises.use-case.ts`                         | Query + paginate via ExerciseRepository                                                                            |
| `backend/src/application/exercise/get-exercises.use-case.spec.ts`                    | Unit tests: no filter, muscle filter, equipment filter, pagination                                                 |
| `backend/src/application/exercise/get-exercise-by-id.use-case.ts`                    | Return Exercise or null                                                                                            |
| `backend/src/application/exercise/get-exercise-by-id.use-case.spec.ts`               | Unit tests: found, not found                                                                                       |
| `backend/src/infrastructure/persistence/entities/exercise.orm-entity.ts`             | TypeORM entity `exercises` with `text[]` columns                                                                   |
| `backend/src/infrastructure/persistence/repositories/typeorm-exercise.repository.ts` | QueryBuilder with `= ANY()` for array filters                                                                      |
| `backend/src/interfaces/http/dto/list-exercises.dto.ts`                              | Query params DTO: `muscleGroup?`, `equipment?`, `page`, `limit` (max 100)                                          |
| `backend/src/interfaces/http/controllers/exercise.controller.ts`                     | `GET /exercises` + `GET /exercises/:id`; throws 404 on null                                                        |
| `backend/src/interfaces/http/controllers/exercise.controller.spec.ts`                | Unit tests: list, filter, detail, 404                                                                              |
| `backend/src/exercise/exercise.module.ts`                                            | Wires ExerciseOrmEntity + repos + use cases + controller                                                           |
| `backend/src/seed/wger-seed.ts`                                                      | Standalone ts-node script: fetch Wger → upsert via DataSource                                                      |
| `frontend/public/everkinetic/`                                                       | Curated Everkinetic SVG diagrams (static assets)                                                                   |

### Modified Files

| File                        | Change                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| `backend/src/app.module.ts` | Add `ExerciseModule`; add `ExerciseOrmEntity` to TypeORM entities array |
| `backend/package.json`      | Add `"seed:wger"` script                                                |

## Implementation Phases

### Phase 1: Domain + persistence

- `exercise.ts` domain model (plain interface)
- `exercise.repository.ts` abstract class
- `exercise.orm-entity.ts` — `text[]` for `muscleGroups` and `equipment`, UUID PK, nullable `wgerId`/`youtubeUrl`/`everkineticSlug`
- `typeorm-exercise.repository.ts` — `findAll` uses QueryBuilder + `= ANY()` conditionally; `findById` by UUID

### Phase 2: Application layer

- `get-exercises.use-case.ts` — delegates to repository; enforces `limit` cap (clamp to 100); returns `{ data, total, page, limit }`
- `get-exercises.use-case.spec.ts` — mock repo: no filter, muscleGroup filter, equipment filter, page 2, limit clamp
- `get-exercise-by-id.use-case.ts` — `execute(id): Promise<Exercise | null>`
- `get-exercise-by-id.use-case.spec.ts` — found + not found

### Phase 3: HTTP layer

- `list-exercises.dto.ts` — class-validator: `@IsOptional @IsString` for filters; `@Type(() => Number) @IsInt @Min(1) @Max(100)` for `limit`; `@Min(1)` for `page`
- `exercise.controller.ts` — `@Get()` list + `@Get(':id')` detail; `@CurrentUser` on both; throws `NotFoundException` on null
- `exercise.controller.spec.ts` — mock use cases: list result, filter passthrough, detail found, 404 thrown

### Phase 4: Wiring + seed

- `exercise.module.ts` — `TypeOrmModule.forFeature([ExerciseOrmEntity])` + use case providers + controller
- `app.module.ts` — add `ExerciseModule`; add `ExerciseOrmEntity` to root TypeORM entities array
- `backend/package.json` — add `"seed:wger": "ts-node -r tsconfig-paths/register src/seed/wger-seed.ts"`
- `wger-seed.ts`:
  - Standalone DataSource (`url = process.env.DATABASE_URL`, entities: `[ExerciseOrmEntity]`, synchronize: false)
  - Parallel lookups: `GET /api/v2/muscle/` + `GET /api/v2/equipment/` → id→name maps
  - Paginated loop: `GET /api/v2/exercise/?format=json&language=2&limit=100&offset=N` with 500ms inter-page delay
  - Filter: skip exercises with no name or no English translation
  - Upsert via `repo.upsert(batch, ['wgerId'])`
  - Logs progress: page N, total upserted

### Phase 5: Everkinetic SVGs

- Download the Everkinetic SVG dataset (front/back body diagrams for key muscle groups) and copy to `frontend/public/everkinetic/`
- Muscle groups to cover: biceps, triceps, chest, back, shoulders, quadriceps, hamstrings, glutes, calves, abs/core, forearms
- Source: https://github.com/everkinetic/data — `muscles/` folder contains per-muscle highlighted body SVGs
- Each file named `{muscle-name}.svg` (e.g. `biceps.svg`, `hamstrings.svg`)
- These are used by F-004 UI; no backend changes needed

## Test Strategy

- **Mocking approach**: Jest `TestingModule` — mock `ExerciseRepository` with `jest.fn()`. Consistent with auth tests. No DB for unit tests.
- **Happy paths**: List with/without filter returns correct shape; `findById` found returns exercise; pagination arithmetic correct
- **Error scenarios**: `findById` null → use case returns null → controller throws `NotFoundException`; `limit=101` → `ValidationPipe` rejects before controller
- **Edge cases**: Page 1 with 0 results (empty DB) → returns `{ data: [], total: 0 }`; filter with no matches → same
- **Not tested**: Seed script (hits external API — manual AC-1/AC-2 verification), Everkinetic static file serving (manual AC-10 verification)

## Risk & Complexity

- **Estimated complexity**: Low–Medium
- **Key risks**:
  - Wger API structure may differ from expected (endpoint paths, JSON shape, pagination format) — mitigate by checking live API before writing seed code
  - TypeORM `text[]` column with `synchronize: true` creates the array column on first run; `upsert()` requires the column to exist — safe in dev but must document for production migration
  - Wger exercise names may contain HTML entities or encoding issues — strip or store raw, handle in F-004 UI
- **New dependencies**: None (ts-node + tsconfig-paths already in devDeps; `fetch` built-in in Node 20)
