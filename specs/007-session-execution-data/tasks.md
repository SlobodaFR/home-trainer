# Tasks: Session Execution — Data Layer

**Plan**: specs/007-session-execution-data/plan.md
**Status**: Ready
**Total**: 22 tasks across 4 phases

---

## Phase 1: Domain + ORM Entity

- [x] **T-1.1**: Extend Session domain interface + update SessionOrmEntity
  - **Do**:
    - In `backend/src/domain/planning/session.ts`: add `'paused'` to `status` union → `'planned' | 'active' | 'paused' | 'completed'`; add `rpe: number | null` and `note: string | null` fields to the `Session` interface
    - In `backend/src/infrastructure/persistence/entities/session.orm-entity.ts`: add `@Column({ type: 'integer', nullable: true }) rpe!: number | null` and `@Column({ type: 'text', nullable: true }) note!: string | null`
    - In `backend/src/infrastructure/persistence/repositories/typeorm-session.repository.ts`: add `rpe` and `note` to `toDomain()` mapping
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.2**: WorkoutLog domain interface + abstract repository
  - **Do**:
    - Create `backend/src/domain/execution/workout-log.ts`:
      ```typescript
      export interface WorkoutLog {
        id: string;
        sessionId: string;
        sessionExerciseId: string;
        userId: string;
        setNumber: number;
        repsCompleted: number | null;
        weightKg: number | null;
        durationSeconds: number | null;
        completedAt: Date;
      }
      ```
    - Create `backend/src/domain/execution/workout-log.repository.ts`:
      ```typescript
      export abstract class WorkoutLogRepository {
        abstract findBySession(sessionId: string): Promise<WorkoutLog[]>;
        abstract save(
          data: Omit<WorkoutLog, 'id' | 'completedAt'>,
        ): Promise<WorkoutLog>;
      }
      ```
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.3**: WorkoutLogOrmEntity
  - **Do**: Create `backend/src/infrastructure/persistence/entities/workout-log.orm-entity.ts`:
    - `@Entity({ name: 'workout_logs' })`
    - `id`: uuid PK `@PrimaryGeneratedColumn('uuid')`
    - `sessionId`: `@Column({ type: 'text', name: 'session_id' })`
    - `sessionExerciseId`: `@Column({ type: 'text', name: 'session_exercise_id' })`
    - `userId`: `@Column({ type: 'text', name: 'user_id' })`
    - `setNumber`: `@Column({ type: 'integer', name: 'set_number' })`
    - `repsCompleted`: `@Column({ type: 'integer', name: 'reps_completed', nullable: true })`
    - `weightKg`: `@Column({ type: 'real', name: 'weight_kg', nullable: true })`
    - `durationSeconds`: `@Column({ type: 'integer', name: 'duration_seconds', nullable: true })`
    - `completedAt`: `@CreateDateColumn({ type: 'datetime', name: 'completed_at' })`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-1.4**: TypeOrmWorkoutLogRepository
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-workout-log.repository.ts`:
    - Extends `WorkoutLogRepository`, injects `@InjectRepository(WorkoutLogOrmEntity)`
    - `findBySession(sessionId)`: `repo.find({ where: { sessionId }, order: { completedAt: 'ASC' } })` → mapped to domain
    - `save(data)`: `repo.save(repo.create({ ...data }))` → mapped to domain
    - `toDomain(entity)`: maps all fields
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

---

## Phase 2: Session Repository + Existing Use-Case Updates

- [x] **T-2.1**: Add `updateStatus` + `saveOutcome` to SessionRepository abstract class
  - **Do**:
    - In `backend/src/domain/planning/session.repository.ts`: add abstract methods:
      - `abstract updateStatus(id: string, status: Session['status']): Promise<Session>`
      - `abstract saveOutcome(id: string, rpe: number | null, note: string | null): Promise<Session>`
    - In `backend/src/infrastructure/persistence/repositories/typeorm-session.repository.ts`: implement both:
      - `updateStatus(id, status)`: `await this.sessionRepo.update(id, { status })` → `return this.findById(id)` (throw if null)
      - `saveOutcome(id, rpe, note)`: `await this.sessionRepo.update(id, { rpe, note })` → `return this.findById(id)` (throw if null)
      - `toDomain` already maps `rpe`/`note` from T-1.1
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-2.2**: Update `SessionRepository.findByUser` + `TypeOrmSessionRepository.findByUser`
  - **Do**:
    - In `backend/src/domain/planning/session.repository.ts`: rename param `onlyPlanned: boolean` → `statusFilter: 'upcoming' | 'all'`
    - In `backend/src/infrastructure/persistence/repositories/typeorm-session.repository.ts`: update `findByUser`:
      - `'upcoming'`: `where: { userId, status: In(['planned', 'active', 'paused']) }` (import `In` from typeorm)
      - `'all'`: `where: { userId }`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-2.3**: Update `GetSessionsUseCase` + spec + `PlanningController` for renamed param
  - **Do**:
    - In `backend/src/application/planning/get-sessions.use-case.ts`: change `onlyPlanned: boolean` param → `statusFilter: 'upcoming' | 'all'`; pass through to repo
    - In `backend/src/application/planning/get-sessions.use-case.spec.ts`: update mock assertion to use `statusFilter: 'upcoming'` / `'all'`
    - In `backend/src/interfaces/http/controllers/planning.controller.ts`: change `getSessionsUseCase.execute(user.id, all !== 'true')` → `getSessionsUseCase.execute(user.id, all !== 'true' ? 'upcoming' : 'all')`
    - In `backend/src/interfaces/http/controllers/planning.controller.spec.ts`: update `getSessions` test to match new call signature
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-sessions.use-case|planning.controller"` — all pass

---

## Phase 3: Execution Use Cases

- [x] **T-3.1**: StartSessionUseCase
  - **Do**: Create `backend/src/application/execution/start-session.use-case.ts`:
    - Injects `SessionRepository`
    - `execute(sessionId: string, userId: string): Promise<Session>`:
      1. `session = await sessionRepository.findById(sessionId)` — throw `NotFoundException` if `session?.userId !== userId`
      2. if `session.status !== 'planned'` → throw `ConflictException('Session is not in planned state')`
      3. return `await sessionRepository.updateStatus(sessionId, 'active')`
  - Create `backend/src/application/execution/start-session.use-case.spec.ts` with tests:
    - planned → active: `updateStatus` called with `'active'`
    - non-planned (active/paused/completed) → `ConflictException`
    - wrong user / not found → `NotFoundException`
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="start-session.use-case"`

- [x] **T-3.2**: PauseSessionUseCase
  - **Do**: Create `backend/src/application/execution/pause-session.use-case.ts`:
    - Same structure as Start; validate `session.status === 'active'`; call `updateStatus('paused')`
  - Create `backend/src/application/execution/pause-session.use-case.spec.ts`:
    - active → paused: `updateStatus` called with `'paused'`
    - non-active → `ConflictException`
    - wrong user → `NotFoundException`
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="pause-session.use-case"`

- [x] **T-3.3**: ResumeSessionUseCase
  - **Do**: Create `backend/src/application/execution/resume-session.use-case.ts`:
    - Validate `session.status === 'paused'`; call `updateStatus('active')`
  - Create `backend/src/application/execution/resume-session.use-case.spec.ts`:
    - paused → active
    - non-paused → `ConflictException`
    - wrong user → `NotFoundException`
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="resume-session.use-case"`

- [x] **T-3.4**: FinishSessionUseCase
  - **Do**: Create `backend/src/application/execution/finish-session.use-case.ts`:
    - Injects `SessionRepository`
    - `execute(sessionId: string, userId: string, rpe: number | null, note: string | null): Promise<Session>`:
      1. Load + auth check (same `session?.userId !== userId` pattern)
      2. if `session.status !== 'active' && session.status !== 'paused'` → throw `ConflictException('Session is not active or paused')`
      3. `await sessionRepository.saveOutcome(sessionId, rpe, note)`
      4. return `await sessionRepository.updateStatus(sessionId, 'completed')`
  - Create `backend/src/application/execution/finish-session.use-case.spec.ts`:
    - active → completed (with rpe + note)
    - paused → completed (OQ-2)
    - planned/completed → `ConflictException`
    - wrong user → `NotFoundException`
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="finish-session.use-case"`

- [x] **T-3.5**: LogSetUseCase
  - **Do**: Create `backend/src/application/execution/log-set.use-case.ts`:
    - Injects `SessionRepository`, `WorkoutLogRepository`
    - `execute(sessionId: string, userId: string, data: { sessionExerciseId: string; setNumber: number; repsCompleted: number | null; weightKg: number | null; durationSeconds: number | null; }): Promise<WorkoutLog>`:
      1. Load session; auth check; throw `NotFoundException` if not found/wrong user
      2. if `session.status !== 'active'` → throw `ConflictException('Session is not active')`
      3. Verify `sessionExerciseId` in `session.exercises` → throw `NotFoundException` if not found
      4. return `await workoutLogRepository.save({ sessionId, userId, ...data })`
  - Create `backend/src/application/execution/log-set.use-case.spec.ts`:
    - active session with valid exercise → WorkoutLog created
    - non-active session → `ConflictException`
    - unknown `sessionExerciseId` → `NotFoundException`
    - wrong user → `NotFoundException`
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="log-set.use-case"`

- [x] **T-3.6**: GetSetsUseCase
  - **Do**: Create `backend/src/application/execution/get-sets.use-case.ts`:
    - Injects `SessionRepository`, `WorkoutLogRepository`
    - `execute(sessionId: string, userId: string): Promise<WorkoutLog[]>`:
      1. Load session; auth check; throw `NotFoundException` if not found/wrong user
      2. return `await workoutLogRepository.findBySession(sessionId)`
  - Create `backend/src/application/execution/get-sets.use-case.spec.ts`:
    - Returns logs array for valid session+user
    - Returns `[]` when no sets logged
    - wrong user → `NotFoundException`
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-sets.use-case"`

---

## Phase 4: HTTP Layer + Wiring

- [x] **T-4.1**: FinishSessionDto + LogSetDto
  - **Do**:
    - Create `backend/src/interfaces/http/dto/finish-session.dto.ts`:
      - `rpe`: `@IsOptional() @IsInt() @Min(1) @Max(10)` (type `number | undefined`)
      - `note`: `@IsOptional() @IsString() @MaxLength(1000)` (type `string | undefined`)
    - Create `backend/src/interfaces/http/dto/log-set.dto.ts`:
      - `sessionExerciseId`: `@IsUUID()`
      - `setNumber`: `@IsInt() @Min(1)`
      - `repsCompleted`: `@IsOptional() @IsInt() @Min(0)`
      - `weightKg`: `@IsOptional() @IsNumber() @Min(0)`
      - `durationSeconds`: `@IsOptional() @IsInt() @Min(1)`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-4.2**: ExecutionController
  - **Do**: Create `backend/src/interfaces/http/controllers/execution.controller.ts`:
    - `@Controller()` (routes are under `sessions/`)
    - `@Post('sessions/:id/start')` → `startSessionUseCase.execute(id, user.id)`
    - `@Post('sessions/:id/pause')` → `pauseSessionUseCase.execute(id, user.id)`
    - `@Post('sessions/:id/resume')` → `resumeSessionUseCase.execute(id, user.id)`
    - `@Post('sessions/:id/finish')` → `finishSessionUseCase.execute(id, user.id, dto.rpe ?? null, dto.note ?? null)` with `@Body() dto: FinishSessionDto`
    - `@Post('sessions/:id/sets')` → `logSetUseCase.execute(id, user.id, { sessionExerciseId: dto.sessionExerciseId, setNumber: dto.setNumber, repsCompleted: dto.repsCompleted ?? null, weightKg: dto.weightKg ?? null, durationSeconds: dto.durationSeconds ?? null })` with `@Body() dto: LogSetDto`
    - `@Get('sessions/:id/sets')` → `getSetsUseCase.execute(id, user.id)`
    - All return types annotated: `Promise<Session>` for state transitions, `Promise<WorkoutLog>` for log, `Promise<WorkoutLog[]>` for get
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.json` — zero errors

- [x] **T-4.3**: ExecutionController spec
  - **Do**: Create `backend/src/interfaces/http/controllers/execution.controller.spec.ts`:
    - Mock all 6 use cases
    - Test each route delegates to correct use case with correct args
    - Test that ConflictException from StartSessionUseCase propagates (no 500 swallowing)
    - Test that NotFoundException propagates
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="execution.controller"`

- [x] **T-4.4**: ExecutionModule + AppModule wiring
  - **Do**:
    - Create `backend/src/execution/execution.module.ts`:
      - `TypeOrmModule.forFeature([SessionOrmEntity, SessionExerciseOrmEntity, WorkoutLogOrmEntity])`
      - Controllers: `[ExecutionController]`
      - Providers: `StartSessionUseCase`, `PauseSessionUseCase`, `ResumeSessionUseCase`, `FinishSessionUseCase`, `LogSetUseCase`, `GetSetsUseCase`
      - Repository binding: `{ provide: SessionRepository, useClass: TypeOrmSessionRepository }`, `{ provide: WorkoutLogRepository, useClass: TypeOrmWorkoutLogRepository }`
    - In `backend/src/app.module.ts`:
      - Import `WorkoutLogOrmEntity` and add to `entities` array in `TypeOrmModule.forRootAsync`
      - Import `ExecutionModule` and add to `imports` array
  - **Test**: `npm run test --workspace=backend` — all existing tests still pass (no regressions)
