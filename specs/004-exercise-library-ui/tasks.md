# Tasks: Exercise Library — UI

**Plan**: specs/004-exercise-library-ui/plan.md
**Status**: Complete
**Total**: 21 tasks across 6 phases

> No CLAUDE.md — test command inferred: `npm run test --workspace=backend -- --testPathPattern=<filename>`

---

## Phase 1: Backend — UserExercise domain + persistence

- [x] **T-1.1**: UserExercise domain interface + abstract repository
  - **Do**: Create `backend/src/domain/exercise/user-exercise.ts` with `interface UserExercise { userId: string; exerciseId: string; isFavorite: boolean; preferenceWeight: number | null; }`. Create `backend/src/domain/exercise/user-exercise.repository.ts` with abstract methods: `findByUser(userId: string): Promise<UserExercise[]>`, `findByUserAndExercise(userId: string, exerciseId: string): Promise<UserExercise | null>`, `upsertFavorite(userId: string, exerciseId: string, isFavorite: boolean): Promise<void>`, `upsertPreference(userId: string, exerciseId: string, weight: number): Promise<void>`.
  - **Test**: `cd backend && npx tsc --noEmit` — zero errors

- [x] **T-1.2**: UserExercise ORM entity
  - **Do**: Create `backend/src/infrastructure/persistence/entities/user-exercise.orm-entity.ts`. Two `@PrimaryColumn('text')`: `userId` (`user_id`) and `exerciseId` (`exercise_id`). `@Column({ type: 'integer', default: 0, name: 'is_favorite' }) isFavorite!: number` (0/1 — SQLite has no boolean). `@Column({ type: 'integer', nullable: true, name: 'preference_weight' }) preferenceWeight!: number | null`. `@Entity({ name: 'user_exercises' })`.
  - **Test**: `cd backend && npx tsc --noEmit` — zero errors

- [x] **T-1.3**: TypeOrmUserExerciseRepository
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-user-exercise.repository.ts` implementing `UserExerciseRepository`. `findByUser`: `repo.findBy({ userId })`, map `isFavorite` int → boolean. `findByUserAndExercise`: `repo.findOneBy({ userId, exerciseId })`. `upsertFavorite`: load existing (or create new entity), set `isFavorite`, `repo.save(entity)`. `upsertPreference`: same pattern for `preferenceWeight`. Inject `@InjectRepository(UserExerciseOrmEntity)`.
  - **Test**: `cd backend && npx tsc --noEmit` — zero errors

- [x] **T-1.4**: ExerciseWithPreference domain type
  - **Do**: Create `backend/src/domain/exercise/exercise-with-preference.ts`: `export interface ExerciseWithPreference extends Exercise { isFavorite: boolean; preferenceWeight: number | null; }`. This is the return type of enriched use cases.
  - **Test**: `cd backend && npx tsc --noEmit` — zero errors

---

## Phase 2: Backend — ToggleFavorite + SetPreference use cases

- [x] **T-2.1**: ToggleFavoriteUseCase + spec
  - **Do**: Create `backend/src/application/exercise/toggle-favorite.use-case.ts`. Constructor injects `UserExerciseRepository`. `execute(userId: string, exerciseId: string, isFavorite: boolean): Promise<boolean>` — calls `upsertFavorite`, returns new boolean value. Create `backend/src/application/exercise/toggle-favorite.use-case.spec.ts` with 2 tests: sets to true; sets to false.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern=toggle-favorite`

- [x] **T-2.2**: SetPreferenceUseCase + DTO + spec
  - **Do**: Create `backend/src/interfaces/http/dto/set-preference.dto.ts`: `@IsInt() @Min(1) @Max(5) weight!: number`. Create `backend/src/application/exercise/set-preference.use-case.ts`. `execute(userId: string, exerciseId: string, weight: number): Promise<void>` — calls `userExerciseRepository.upsertPreference`. Create spec with 2 tests: saves weight 3; saves weight 1.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern=set-preference`

---

## Phase 3: Backend — Enrich use cases + controller + wiring

- [x] **T-3.1**: Update GetExercisesUseCase to return ExerciseWithPreference[]
  - **Do**: Modify `backend/src/application/exercise/get-exercises.use-case.ts`. Add `UserExerciseRepository` to constructor. Add `userId: string` to `execute` params. After fetching exercises, call `userExerciseRepository.findByUser(userId)` and build a `Map<exerciseId, UserExercise>`. Map each `Exercise` → `ExerciseWithPreference` using defaults `isFavorite: false`, `preferenceWeight: null` when no row exists. Return `{ data: ExerciseWithPreference[]; total; page; limit }`. Update `backend/src/application/exercise/get-exercises.use-case.spec.ts` — add userId param to all execute calls, add test for enrichment.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern=get-exercises`

- [x] **T-3.2**: Update GetExerciseByIdUseCase to return ExerciseWithPreference | null
  - **Do**: Modify `backend/src/application/exercise/get-exercise-by-id.use-case.ts`. Add `UserExerciseRepository` to constructor. Add `userId: string` to `execute` params. After fetching exercise, call `userExerciseRepository.findByUserAndExercise(userId, id)` and merge into `ExerciseWithPreference`. Update `backend/src/application/exercise/get-exercise-by-id.use-case.spec.ts` accordingly.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern=get-exercise-by-id`

- [x] **T-3.3**: Update ExerciseController — inject @CurrentUser, add favorite/preference endpoints
  - **Do**: Modify `backend/src/interfaces/http/controllers/exercise.controller.ts`. Import `CurrentUser`, `CurrentUserPayload`. Add `@CurrentUser() user: CurrentUserPayload` to `list` and `detail` handlers; pass `user.id` as `userId` to use cases. Add: `@Post(':id/favorite') markFavorite(...)` → calls `ToggleFavoriteUseCase(true)`, returns `{ isFavorite: boolean }`. Add: `@Delete(':id/favorite') removeFavorite(...)` → calls `ToggleFavoriteUseCase(false)`. Add: `@Patch(':id/preference') setExercisePreference(...)` → calls `SetPreferenceUseCase`, returns 204. Inject `ToggleFavoriteUseCase` and `SetPreferenceUseCase` in constructor.
  - **Test**: `cd backend && npx tsc --noEmit`

- [x] **T-3.4**: Update ExerciseController spec
  - **Do**: Modify `backend/src/interfaces/http/controllers/exercise.controller.spec.ts`. Add `mockUser` with `id: 'user-1'`. Update `list` and `detail` mock calls to pass mockUser. Add tests: `markFavorite` returns `{ isFavorite: true }`; `removeFavorite` returns `{ isFavorite: false }`; `setExercisePreference` calls use case with weight.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern=exercise.controller`

- [x] **T-3.5**: Update ExerciseModule + AppModule
  - **Do**: Modify `backend/src/exercise/exercise.module.ts` — add `UserExerciseOrmEntity` to `TypeOrmModule.forFeature`, add `UserExerciseRepository` provider (`useClass: TypeOrmUserExerciseRepository`), add `ToggleFavoriteUseCase` and `SetPreferenceUseCase` to providers. Modify `backend/src/app.module.ts` — add `UserExerciseOrmEntity` to the entities array in `TypeOrmModule.forRootAsync`.
  - **Test**: `npm run test --workspace=backend` — all 10 suites pass

---

## Phase 4: Frontend — Infrastructure + shared + routing

- [x] **T-4.1**: exercise-client.ts
  - **Do**: Create `frontend/src/infrastructure/exercise-client.ts`. Typed fetch wrappers (all use `credentials: 'include'`).
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-4.2**: Tailwind custom colors
  - **Do**: Modify `frontend/tailwind.config.ts`. Add `extend.colors`: `ink: '#111111'`, `canvas: '#ffffff'`, `'soft-cloud': '#f5f5f5'`, `mute: '#707072'`, `success: '#007d48'`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-4.3**: Toast component + hook
  - **Do**: Create `frontend/src/presentation/shared/useToast.ts` and `frontend/src/presentation/shared/Toast.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-4.4**: App.tsx routing + layout
  - **Do**: Modify `frontend/src/App.tsx`. Add Routes for `/exercises` and `/exercises/:id` inside `RequireAuth`. Redirect `/` to `/exercises`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

---

## Phase 5: Frontend — Exercise list page

- [x] **T-5.1**: FilterChips component
  - **Do**: Create `frontend/src/presentation/exercises/FilterChips.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-5.2**: ExerciseCard component
  - **Do**: Create `frontend/src/presentation/exercises/ExerciseCard.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-5.3**: ExercisesPage
  - **Do**: Create `frontend/src/presentation/exercises/ExercisesPage.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

---

## Phase 6: Frontend — Exercise detail page

- [x] **T-6.1**: EverkineticViewer component
  - **Do**: Create `frontend/src/presentation/exercises/EverkineticViewer.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-6.2**: PreferenceWeight component
  - **Do**: Create `frontend/src/presentation/exercises/PreferenceWeight.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-6.3**: FavoriteButton component
  - **Do**: Create `frontend/src/presentation/exercises/FavoriteButton.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors

- [x] **T-6.4**: ExerciseDetailPage
  - **Do**: Create `frontend/src/presentation/exercises/ExerciseDetailPage.tsx`.
  - **Test**: `cd frontend && npx tsc --noEmit` — zero errors
