# Tasks: Exercise Library — Data Layer

**Plan**: specs/003-exercise-library-data/plan.md
**Status**: Ready
**Total**: 21 tasks across 5 phases

## Phase 1: Domain + Persistence

- [x] **T-1.1**: Create `exercise.ts` domain model
  - **Do**: Create `backend/src/domain/exercise/exercise.ts` — export interface `Exercise { id: string; wgerId: number | null; name: string; description: string; muscleGroups: string[]; equipment: string[]; youtubeUrl: string | null; everkineticSlug: string | null; createdAt: Date; }`
  - **Test**: `npx tsc --noEmit` in backend — zero errors

- [x] **T-1.2**: Create `exercise.repository.ts` abstract class
  - **Do**: Create `backend/src/domain/exercise/exercise.repository.ts` — export abstract class `ExerciseRepository` with two abstract methods: `findAll(params: { muscleGroup?: string; equipment?: string; page: number; limit: number }): Promise<{ data: Exercise[]; total: number }>` and `findById(id: string): Promise<Exercise | null>`
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-1.3**: Create `exercise.orm-entity.ts`
  - **Do**: Create `backend/src/infrastructure/persistence/entities/exercise.orm-entity.ts`. `@Entity({ name: 'exercises' })`. Columns: `@PrimaryGeneratedColumn('uuid') id`, `@Column({ type: 'int', name: 'wger_id', unique: true, nullable: true }) wgerId`, `@Column({ type: 'text', unique: true }) name`, `@Column({ type: 'text', default: '' }) description`, `@Column({ type: 'text', array: true, name: 'muscle_groups', default: '{}' }) muscleGroups: string[]`, `@Column({ type: 'text', array: true, default: '{}' }) equipment: string[]`, `@Column({ type: 'text', name: 'youtube_url', nullable: true }) youtubeUrl`, `@Column({ type: 'text', name: 'everkinetic_slug', nullable: true }) everkineticSlug`, `@CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt`
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-1.4**: Create `typeorm-exercise.repository.ts`
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-exercise.repository.ts`. Extends `ExerciseRepository`, injects `@InjectRepository(ExerciseOrmEntity)`. `findAll`: use `createQueryBuilder('exercise')`; conditionally add `.andWhere(':muscle = ANY(exercise.muscle_groups)', { muscle })` and `.andWhere(':equip = ANY(exercise.equipment)', { equip })`; add `.skip((page - 1) * limit).take(limit)`; return `getManyAndCount()` mapped to `{ data: Exercise[], total }`. `findById`: `findOne({ where: { id } })` returning mapped domain object or null.
  - **Test**: `npx tsc --noEmit` — zero errors

## Phase 2: Application Layer

- [x] **T-2.1**: Create `get-exercises.use-case.ts`
  - **Do**: Create `backend/src/application/exercise/get-exercises.use-case.ts`. `@Injectable()`. Inject `ExerciseRepository`. Method `execute(params: { muscleGroup?: string; equipment?: string; page?: number; limit?: number }): Promise<{ data: Exercise[]; total: number; page: number; limit: number }>`. Clamp `limit` to max 100, default 20; default `page` to 1. Delegates to `this.exerciseRepository.findAll(...)`. Returns `{ data, total, page, limit }`.
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-2.2**: Write `get-exercises.use-case.spec.ts`
  - **Do**: Create `backend/src/application/exercise/get-exercises.use-case.spec.ts`. Use `Test.createTestingModule` with mocked `ExerciseRepository`. Four tests: (1) no filter → `findAll` called with `{ page: 1, limit: 20, muscleGroup: undefined, equipment: undefined }` and returns `{ data: [...], total: 5, page: 1, limit: 20 }`; (2) `muscleGroup: 'biceps'` → passed through; (3) `equipment: 'barbell'` → passed through; (4) `limit: 150` → clamped to 100.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=get-exercises.use-case.spec` — 4 tests green

- [x] **T-2.3**: Create `get-exercise-by-id.use-case.ts`
  - **Do**: Create `backend/src/application/exercise/get-exercise-by-id.use-case.ts`. `@Injectable()`. Inject `ExerciseRepository`. `execute(id: string): Promise<Exercise | null>` — delegates to `this.exerciseRepository.findById(id)`.
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-2.4**: Write `get-exercise-by-id.use-case.spec.ts`
  - **Do**: Create `backend/src/application/exercise/get-exercise-by-id.use-case.spec.ts`. Two tests: (1) `findById` returns an exercise → use case returns it; (2) `findById` returns null → use case returns null.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=get-exercise-by-id.use-case.spec` — 2 tests green

## Phase 3: HTTP Layer

- [x] **T-3.1**: Create `list-exercises.dto.ts`
  - **Do**: Create `backend/src/interfaces/http/dto/list-exercises.dto.ts`. Export class `ListExercisesDto`: `@IsOptional() @IsString() muscleGroup?: string`; `@IsOptional() @IsString() equipment?: string`; `@Type(() => Number) @IsOptional() @IsInt() @Min(1) page = 1`; `@Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20`.
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-3.2**: Create `exercise.controller.ts`
  - **Do**: Create `backend/src/interfaces/http/controllers/exercise.controller.ts`. `@Controller('exercises')`. Two handlers: (1) `@Get() async list(@Query() query: ListExercisesDto, @CurrentUser() _user: CurrentUserPayload)` — calls `GetExercisesUseCase.execute(query)`, returns result directly; (2) `@Get(':id') async detail(@Param('id') id: string, @CurrentUser() _user: CurrentUserPayload)` — calls `GetExerciseByIdUseCase.execute(id)`, throws `NotFoundException('Exercise not found')` if null, else returns exercise.
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-3.3**: Write `exercise.controller.spec.ts`
  - **Do**: Create `backend/src/interfaces/http/controllers/exercise.controller.spec.ts`. Use `Test.createTestingModule` with mocked `GetExercisesUseCase` and `GetExerciseByIdUseCase`. Four tests: (1) `list()` returns use case result; (2) `list()` passes `muscleGroup` from query to use case; (3) `detail()` returns exercise when found; (4) `detail()` throws `NotFoundException` when use case returns null.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=exercise.controller.spec` — 4 tests green

## Phase 4: Wiring + Seed

- [x] **T-4.1**: Create `exercise.module.ts`
  - **Do**: Create `backend/src/exercise/exercise.module.ts`. `@Module({ imports: [TypeOrmModule.forFeature([ExerciseOrmEntity])], controllers: [ExerciseController], providers: [GetExercisesUseCase, GetExerciseByIdUseCase, { provide: ExerciseRepository, useClass: TypeOrmExerciseRepository }] })`. Export `ExerciseModule`.
  - **Test**: `npx tsc --noEmit` — zero errors

- [x] **T-4.2**: Wire `ExerciseModule` into `AppModule`
  - **Do**: Modify `backend/src/app.module.ts` — import `ExerciseModule` and add to `imports[]`; add `ExerciseOrmEntity` to the TypeORM `entities` array.
  - **Test**: `npm test --workspace=backend` — all 14 existing tests still green (app boots with new module)

- [x] **T-4.3**: Add `seed:wger` script to `backend/package.json`
  - **Do**: Add `"seed:wger": "ts-node -r tsconfig-paths/register src/seed/wger-seed.ts"` to `scripts` in `backend/package.json`.
  - **Test**: `cd backend && npx ts-node --version` — exits 0 (ts-node available)

- [x] **T-4.4**: Create Wger seed script
  - **Do**: Create `backend/src/seed/wger-seed.ts`. Structure:
    1. Create bare `DataSource({ type: 'postgres', url: process.env['DATABASE_URL'], entities: [ExerciseOrmEntity], synchronize: false })` and `initialize()`.
    2. Parallel fetch: `GET https://wger.de/api/v2/muscle/?format=json&limit=100` and `GET https://wger.de/api/v2/equipment/?format=json&limit=100` → build `muscleMap: Map<number, string>` and `equipmentMap: Map<number, string>`.
    3. Paginated loop over `GET https://wger.de/api/v2/exercise/?format=json&language=2&limit=100&offset=N`. For each page response check `results` array; skip entries with empty `name`; resolve `muscles` and `equipment` ID arrays to name strings using the maps. Build `ExerciseOrmEntity` objects (set `id` to `undefined` so Postgres generates UUID, set `wgerId` from response `id`). Batch `repo.upsert(batch, { conflictPaths: ['wgerId'], skipUpdateIfNoValuesChanged: true })`. Log `[wger-seed] page N — upserted X exercises`. Sleep 500ms between pages. Stop when `next` is null.
    4. `dataSource.destroy()`. Log total.
    5. Wrap in `main()` with `try/catch`, exit 1 on error.
  - **Test**: Manual — `DATABASE_URL=<local> npm run seed:wger --workspace=backend` — exits 0; `SELECT COUNT(*) FROM exercises` returns ≥ 50

## Phase 5: Everkinetic Assets

- [x] **T-5.1**: Download Everkinetic muscle group SVGs
  - **Do**: Create `frontend/public/everkinetic/` directory. Download per-muscle SVG diagrams from the Everkinetic dataset (https://github.com/everkinetic/data). Target muscle slugs: `biceps`, `triceps`, `chest`, `back`, `shoulders`, `quadriceps`, `hamstrings`, `glutes`, `calves`, `abs`, `forearms`. Files go to `frontend/public/everkinetic/{slug}.svg`. If the dataset organizes files differently, adapt slug names to match actual filenames and note the mapping.
  - **Test**: `ls frontend/public/everkinetic/*.svg` — lists ≥ 5 files; `npm run dev:frontend` and visit `http://localhost:5173/everkinetic/biceps.svg` — SVG loads

## Phase 6: Full Suite

- [x] **T-6.1**: Run full test suite
  - **Do**: From repo root run `npm test`. Verify all tests pass including the new exercise use case and controller specs.
  - **Test**: `npm test` — exits 0, all suites green (expected ≥ 20 tests total)
