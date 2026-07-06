# Tasks: Goal & Planning — Data Layer

**Plan**: specs/005-goal-planning-data/plan.md
**Status**: Complete
**Total**: 19 tasks across 3 phases

---

## Phase 1: Domain + ORM Entities + Repositories

- [x] **T-1.1**: Domain interfaces — Goal, Session, SessionExercise
  - **Do**: Create three files:
    - `backend/src/domain/planning/goal.ts` — `export interface Goal { id: string; userId: string; type: 'strength' | 'mobility' | 'endurance' | 'general'; targetDescription: string; horizonWeeks: number; availabilityDays: number[]; sessionDurationMinutes: number; availableEquipment: string[]; activeFrom: string; isActive: boolean; createdAt: Date; }`
    - `backend/src/domain/planning/session-exercise.ts` — `export interface SessionExercise { id: string; sessionId: string; exerciseId: string; exerciseName: string; order: number; sets: number; repsOrDuration: string; }`
    - `backend/src/domain/planning/session.ts` — `export interface Session { id: string; userId: string; goalId: string; plannedDate: string; status: 'planned' | 'active' | 'completed'; createdAt: Date; exercises: SessionExercise[]; }`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.2**: Abstract GoalRepository
  - **Do**: Create `backend/src/domain/planning/goal.repository.ts` — `export abstract class GoalRepository { abstract findActiveByUser(userId: string): Promise<Goal | null>; abstract save(data: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal>; abstract deactivateAllForUser(userId: string): Promise<void>; }`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.3**: Abstract SessionRepository + transfer types
  - **Do**: Create `backend/src/domain/planning/session.repository.ts`:
    - Export `interface NewSessionExercise { exerciseId: string; exerciseName: string; order: number; sets: number; repsOrDuration: string; }`
    - Export `interface NewSession { userId: string; goalId: string; plannedDate: string; exercises: NewSessionExercise[]; }`
    - Export `abstract class SessionRepository { abstract findByUser(userId: string, onlyPlanned: boolean): Promise<Session[]>; abstract findById(id: string): Promise<Session | null>; abstract saveAll(sessions: NewSession[]): Promise<void>; abstract replaceExercises(sessionId: string, exercises: NewSessionExercise[]): Promise<Session>; }`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.4**: GoalOrmEntity
  - **Do**: Create `backend/src/infrastructure/persistence/entities/goal.orm-entity.ts`:
    - `@Entity({ name: 'goals' })` with columns: `id` (uuid PK), `userId` (text), `type` (text), `targetDescription` (text), `horizonWeeks` (integer), `availabilityDays` (simple-json), `sessionDurationMinutes` (integer), `availableEquipment` (simple-json), `activeFrom` (text), `isActive` (integer default 0), `createdAt` (datetime CreateDateColumn)
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.5**: SessionExerciseOrmEntity
  - **Do**: Create `backend/src/infrastructure/persistence/entities/session-exercise.orm-entity.ts`:
    - `@Entity({ name: 'session_exercises' })` with columns: `id` (uuid PK), `sessionId` (text column + `@ManyToOne` via `@JoinColumn({ name: 'session_id' })` to SessionOrmEntity), `exerciseId` (text), `exerciseName` (text), `order` (integer), `sets` (integer), `repsOrDuration` (text)
    - Import SessionOrmEntity using a forward reference or place SessionOrmEntity file first — import directly since session.orm-entity will be created next task
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.6**: SessionOrmEntity
  - **Do**: Create `backend/src/infrastructure/persistence/entities/session.orm-entity.ts`:
    - `@Entity({ name: 'sessions' })` with columns: `id` (uuid PK), `userId` (text), `goalId` (text), `plannedDate` (text), `status` (text default `'planned'`), `createdAt` (datetime CreateDateColumn)
    - `@OneToMany(() => SessionExerciseOrmEntity, (se) => se.session, { cascade: true })` for `exercises`
    - Update `backend/src/infrastructure/persistence/entities/session-exercise.orm-entity.ts` `@ManyToOne` to point to `SessionOrmEntity`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.7**: TypeOrmGoalRepository
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-goal.repository.ts`:
    - Extends `GoalRepository`, injects `@InjectRepository(GoalOrmEntity)`
    - `findActiveByUser`: `findOneBy({ userId, isActive: 1 })` → toDomain or null
    - `save`: `repo.create({...data, isActive: data.isActive ? 1 : 0})` then `repo.save()` → toDomain
    - `deactivateAllForUser`: `repo.update({ userId }, { isActive: 0 })`
    - `toDomain()`: maps `isActive: 1` → `true`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.8**: TypeOrmSessionRepository
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-session.repository.ts`:
    - Extends `SessionRepository`, injects `@InjectRepository(SessionOrmEntity)` and `@InjectRepository(SessionExerciseOrmEntity)`
    - `findByUser(userId, onlyPlanned)`: find by `{ userId, ...(onlyPlanned ? { status: 'planned' } : {}) }` ordered by `plannedDate ASC`, no relations loaded
    - `findById(id)`: `findOne({ where: { id }, relations: { exercises: true }, order: { exercises: { order: 'ASC' } } })` → toDomain with exercises
    - `saveAll(sessions)`: for each session, `sessionRepo.save(sessionRepo.create({...}))` then `sessionExerciseRepo.save(exercises.map(e => exerciseRepo.create({...})))`
    - `replaceExercises(sessionId, exercises)`: `exerciseRepo.delete({ sessionId })` → insert new → `findById(sessionId)` → return
    - `toDomain()` converts `SessionOrmEntity` (with optional `exercises` relation) to `Session`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

---

## Phase 2: Application Layer — PlannerService + Use Cases

- [x] **T-2.1**: PlannerService — date generation + exercise selection algorithm
  - **Do**: Create `backend/src/application/planning/planner.service.ts`:
    - `@Injectable() export class PlannerService`
    - `generateDates(activeFrom: string, horizonWeeks: number, availabilityDays: number[]): string[]` — iterate days `[activeFrom, activeFrom + horizonWeeks*7)`, collect ISO strings where `new Date(date).getDay()` is in `availabilityDays`
    - `buildSessionExercises(goal: Pick<Goal, 'sessionDurationMinutes' | 'availableEquipment'>, exercises: ExerciseWithPreference[]): NewSessionExercise[]`:
      1. Filter: keep exercises where `exercise.equipment.length === 0` (bodyweight) OR `exercise.equipment.some(eq => goal.availableEquipment.includes(eq))`; if none pass and `availableEquipment` is non-empty, fall back to `equipment.length === 0` only
      2. Sort: favorites first (`isFavorite DESC`), then by `preferenceWeight DESC NULLS LAST`, shuffle the tail (items after last preferenceWeight item)
      3. Slice: `Math.max(1, Math.floor(goal.sessionDurationMinutes / 5))` items
      4. Map to `NewSessionExercise` with `sets: 3, repsOrDuration: '10'`
    - `generateSessions(goal: Goal, exercises: ExerciseWithPreference[]): NewSession[]` — calls `generateDates` + maps each date with `buildSessionExercises`
  - Create `backend/src/application/planning/planner.service.spec.ts`:
    - Test `generateDates`: correct dates selected, correct count for 2-week horizon
    - Test `buildSessionExercises`: equipment filter applied, favorites first, budget respected (floor(30/5)=6), empty equipment list returns bodyweight exercises
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="planner.service"`

- [x] **T-2.2**: CreateGoalUseCase
  - **Do**: Create `backend/src/application/planning/create-goal.use-case.ts`:
    - Injects `GoalRepository`, `SessionRepository`, `ExerciseRepository`, `UserExerciseRepository`, `PlannerService`
    - `execute(userId: string, data: Omit<Goal, 'id' | 'userId' | 'isActive' | 'createdAt'>): Promise<Goal>`:
      1. `goalRepository.deactivateAllForUser(userId)`
      2. `goal = await goalRepository.save({ ...data, userId, isActive: true })`
      3. Load exercises: `exerciseRepo.findAll({ page: 1, limit: 1000 })` (or a new `findAllForPlanning()` method — use existing `findAll` with high limit for now)
      4. Load user preferences: `userExerciseRepo.findByUser(userId)` → build preference map
      5. Enrich exercises: map to `ExerciseWithPreference`
      6. `sessions = plannerService.generateSessions(goal, enrichedExercises)`
      7. `await sessionRepository.saveAll(sessions.map(s => ({ ...s, userId, goalId: goal.id })))`
      8. Return `goal`
  - Create `backend/src/application/planning/create-goal.use-case.spec.ts` — mock all 5 deps, verify deactivate called before save, sessions saved after planning
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="create-goal.use-case"`

- [x] **T-2.3**: GetActiveGoalUseCase
  - **Do**: Create `backend/src/application/planning/get-active-goal.use-case.ts`:
    - Injects `GoalRepository`
    - `execute(userId: string): Promise<Goal | null>` — `return this.goalRepository.findActiveByUser(userId)`
  - Create `backend/src/application/planning/get-active-goal.use-case.spec.ts` — verify returns null when repo returns null, returns goal otherwise
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-active-goal.use-case"`

- [x] **T-2.4**: GetSessionsUseCase
  - **Do**: Create `backend/src/application/planning/get-sessions.use-case.ts`:
    - Injects `SessionRepository`
    - `execute(userId: string, onlyPlanned: boolean): Promise<Session[]>` — `return this.sessionRepository.findByUser(userId, onlyPlanned)`
  - Create `backend/src/application/planning/get-sessions.use-case.spec.ts` — verify `findByUser` called with correct `onlyPlanned` arg
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-sessions.use-case"`

- [x] **T-2.5**: GetSessionByIdUseCase
  - **Do**: Create `backend/src/application/planning/get-session-by-id.use-case.ts`:
    - Injects `SessionRepository`
    - `execute(id: string, userId: string): Promise<Session | null>`:
      - Load session with `findById(id)` — return `null` if not found OR `session.userId !== userId`
  - Create `backend/src/application/planning/get-session-by-id.use-case.spec.ts` — test: found + same user → session; found + different user → null; not found → null
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-session-by-id.use-case"`

- [x] **T-2.6**: ReplanSessionUseCase
  - **Do**: Create `backend/src/application/planning/replan-session.use-case.ts`:
    - Injects `SessionRepository`, `GoalRepository`, `ExerciseRepository`, `UserExerciseRepository`, `PlannerService`
    - `execute(sessionId: string, userId: string): Promise<Session>`:
      1. `session = await sessionRepository.findById(sessionId)` — throw `NotFoundException` if null or `session.userId !== userId`
      2. If `session.status !== 'planned'` → throw `ConflictException('Cannot replan a session that is not planned')`
      3. Load active goal → throw `NotFoundException` if none
      4. Load + enrich exercises (same as CreateGoal)
      5. `exercises = plannerService.buildSessionExercises(goal, enrichedExercises)`
      6. Return `await sessionRepository.replaceExercises(sessionId, exercises)`
  - Create `backend/src/application/planning/replan-session.use-case.spec.ts`:
    - Test: planned session → exercises replaced → session returned
    - Test: active session → ConflictException
    - Test: wrong user → NotFoundException
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="replan-session.use-case"`

---

## Phase 3: HTTP Layer + Wiring

- [x] **T-3.1**: CreateGoalDto
  - **Do**: Create `backend/src/interfaces/http/dto/create-goal.dto.ts`:
    - `type`: `@IsIn(['strength', 'mobility', 'endurance', 'general'])`
    - `targetDescription`: `@IsString() @MaxLength(500)`
    - `horizonWeeks`: `@Type(() => Number) @IsInt() @Min(1) @Max(52)`
    - `availabilityDays`: `@IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) @ArrayMinSize(1)`
    - `sessionDurationMinutes`: `@Type(() => Number) @IsInt() @Min(20) @Max(120)`
    - `availableEquipment`: `@IsArray() @IsString({ each: true })`
    - `activeFrom`: `@IsOptional() @IsDateString()` — optional, use today's ISO date in use case if absent
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-3.2**: PlanningController + spec
  - **Do**: Create `backend/src/interfaces/http/controllers/planning.controller.ts`:
    - `@Controller()` (no prefix — routes: `goals`, `sessions`)
    - `@Post('goals') async createGoal(@Body() dto: CreateGoalDto, @CurrentUser() user): Promise<Goal>`
      - `activeFrom = dto.activeFrom ?? new Date().toISOString().slice(0, 10)`
      - Calls `createGoalUseCase.execute(user.id, { ...dto, activeFrom })`
    - `@Get('goals/active') async getActiveGoal(@CurrentUser() user): Promise<Goal>` — throws `NotFoundException` if null
    - `@Get('sessions') async getSessions(@Query('all') all: string, @CurrentUser() user): Promise<Session[]>` — `onlyPlanned = all !== 'true'`
    - `@Get('sessions/:id') async getSession(@Param('id') id: string, @CurrentUser() user): Promise<Session>` — throws `NotFoundException` if null
    - `@Post('sessions/:id/replan') async replanSession(@Param('id') id: string, @CurrentUser() user): Promise<Session>`
  - Create `backend/src/interfaces/http/controllers/planning.controller.spec.ts`:
    - Mock all 4 use cases
    - Test `getActiveGoal` → 404 when null
    - Test `getSession` → 404 when null
    - Test `replanSession` → propagates ConflictException from use case
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="planning.controller"`

- [x] **T-3.3**: PlanningModule
  - **Do**: Create `backend/src/planning/planning.module.ts`:
    - `TypeOrmModule.forFeature([GoalOrmEntity, SessionOrmEntity, SessionExerciseOrmEntity, ExerciseOrmEntity, UserExerciseOrmEntity])`
    - Controllers: `[PlanningController]`
    - Providers: `PlannerService`, `CreateGoalUseCase`, `GetActiveGoalUseCase`, `GetSessionsUseCase`, `GetSessionByIdUseCase`, `ReplanSessionUseCase`
    - Repository bindings: `{ provide: GoalRepository, useClass: TypeOrmGoalRepository }`, `{ provide: SessionRepository, useClass: TypeOrmSessionRepository }`, `{ provide: ExerciseRepository, useClass: TypeOrmExerciseRepository }`, `{ provide: UserExerciseRepository, useClass: TypeOrmUserExerciseRepository }`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-3.4**: Wire entities + module into AppModule
  - **Do**: Modify `backend/src/app.module.ts`:
    - Import `GoalOrmEntity`, `SessionOrmEntity`, `SessionExerciseOrmEntity`
    - Add all three to the `entities` array in `TypeOrmModule.forRootAsync`
    - Import `PlanningModule` and add to the `imports` array
  - **Test**: `npm run test --workspace=backend` — all 33 existing tests still pass (no regressions)
