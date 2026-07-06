# Plan: Session Execution — Data Layer

**Spec**: specs/007-session-execution-data/spec.md

## Architecture Decisions

### AD-1: WorkoutLog as a new domain + new module (ExecutionModule)

- **Choice**: New `backend/src/execution/execution.module.ts` handling all F-007 concerns. Does NOT extend `PlanningModule` — it imports `SessionOrmEntity` and `WorkoutLogOrmEntity` independently.
- **Rationale**: Planning is concerned with session generation; Execution is concerned with session lifecycle and set logging. Separate modules avoid cross-domain coupling. PlanningModule re-registration pattern (AD-4 from F-005) applies here.
- **Alternatives considered**: Adding all F-007 endpoints to PlanningController (would mix planning and execution concerns in one module)

### AD-2: State machine enforced in use cases, not in the ORM entity

- **Choice**: Each transition use case (`StartSessionUseCase`, `PauseSessionUseCase`, etc.) loads the session, validates the current status, throws `ConflictException` if invalid, then calls `sessionRepository.updateStatus(id, newStatus)`. No `@BeforeUpdate` hook.
- **Rationale**: Same pattern as F-005 (`ReplanSessionUseCase` validates `session.status !== 'planned'`). Business rules in use cases, persistence in repositories.
- **Alternatives considered**: State machine library (overkill for 4 states), guard in entity setter (hides logic away from the use case layer)

### AD-3: Session.status extended to include 'paused'

- **Choice**: Domain `Session.status` updated to `'planned' | 'active' | 'paused' | 'completed'`. `SessionOrmEntity.status` column already `text` — no schema migration needed. `GetSessionsUseCase` + `SessionRepository.findByUser` updated to pass `statusFilter: 'upcoming' | 'all'` instead of `onlyPlanned: boolean`.
- **Rationale**: `onlyPlanned: boolean` cannot express "planned + active + paused". Renaming the param is cleaner than adding a third boolean.
- **Alternatives considered**: Keep `onlyPlanned` and add `includeActive` boolean (boolean hell); expose raw status filter array (overly flexible for a single-user app)

### AD-4: WorkoutLogRepository as new abstract class + TypeORM impl

- **Choice**: `domain/execution/workout-log.repository.ts` (abstract) + `infrastructure/persistence/repositories/typeorm-workout-log.repository.ts` (impl), injected into use cases.
- **Rationale**: Same clean architecture pattern as GoalRepository, SessionRepository. Keeps infrastructure out of domain/application layers.
- **Alternatives considered**: Direct TypeORM repo injection in use cases (breaks clean arch)

### AD-5: RPE + note stored on SessionOrmEntity, not a separate table

- **Choice**: `rpe: integer | null` and `note: text | null` columns added to `sessions` table. Domain `Session` interface extended with these fields.
- **Rationale**: RPE and note are properties of the completed session, not a separate entity. F-009 LLM job will read them from `sessions` directly. No separate join needed.
- **Alternatives considered**: Separate `SessionOutcome` table (over-normalized for 2 fields)

### AD-6: `GET /sessions` filter change — `?status=upcoming` default

- **Choice**: `GET /sessions?all=true` remains supported (backward compat with F-006 dashboard). Internally `onlyPlanned` parameter renamed to a status-set filter: `'upcoming'` = `['planned', 'active', 'paused']`, `'all'` = all statuses. Controller keeps `?all=true` query param API unchanged.
- **Rationale**: F-006 frontend uses `GET /api/sessions` (no `?all=`). Including `active`/`paused` in the default response is the OQ-1 assumption. `all !== 'true'` → upcoming filter.
- **Alternatives considered**: Breaking `?all` param (would require F-006 frontend change)

## Affected Files

### New Files

| File                                                                                    | Purpose                                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `backend/src/domain/execution/workout-log.ts`                                           | `WorkoutLog` domain interface                                                   |
| `backend/src/domain/execution/workout-log.repository.ts`                                | Abstract `WorkoutLogRepository`                                                 |
| `backend/src/application/execution/start-session.use-case.ts`                           | planned → active                                                                |
| `backend/src/application/execution/start-session.use-case.spec.ts`                      | Unit tests                                                                      |
| `backend/src/application/execution/pause-session.use-case.ts`                           | active → paused                                                                 |
| `backend/src/application/execution/pause-session.use-case.spec.ts`                      | Unit tests                                                                      |
| `backend/src/application/execution/resume-session.use-case.ts`                          | paused → active                                                                 |
| `backend/src/application/execution/resume-session.use-case.spec.ts`                     | Unit tests                                                                      |
| `backend/src/application/execution/finish-session.use-case.ts`                          | active                                                                          | paused → completed, save RPE+note |
| `backend/src/application/execution/finish-session.use-case.spec.ts`                     | Unit tests                                                                      |
| `backend/src/application/execution/log-set.use-case.ts`                                 | Create WorkoutLog record                                                        |
| `backend/src/application/execution/log-set.use-case.spec.ts`                            | Unit tests                                                                      |
| `backend/src/application/execution/get-sets.use-case.ts`                                | List WorkoutLogs for session                                                    |
| `backend/src/application/execution/get-sets.use-case.spec.ts`                           | Unit tests                                                                      |
| `backend/src/infrastructure/persistence/entities/workout-log.orm-entity.ts`             | TypeORM entity                                                                  |
| `backend/src/infrastructure/persistence/repositories/typeorm-workout-log.repository.ts` | TypeORM impl                                                                    |
| `backend/src/interfaces/http/dto/finish-session.dto.ts`                                 | `{ rpe?: 1–10, note?: string }`                                                 |
| `backend/src/interfaces/http/dto/log-set.dto.ts`                                        | `{ sessionExerciseId, setNumber, repsCompleted?, weightKg?, durationSeconds? }` |
| `backend/src/interfaces/http/controllers/execution.controller.ts`                       | 6 endpoints                                                                     |
| `backend/src/interfaces/http/controllers/execution.controller.spec.ts`                  | Controller unit tests                                                           |
| `backend/src/execution/execution.module.ts`                                             | NestJS module wiring                                                            |

### Modified Files

| File                                                                                | Change                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `backend/src/domain/planning/session.ts`                                            | Add `'paused'` to status union; add `rpe: number \| null`, `note: string \| null`                   |
| `backend/src/domain/planning/session.repository.ts`                                 | `findByUser` param renamed from `onlyPlanned: boolean` to `statusFilter: 'upcoming' \| 'all'`       |
| `backend/src/infrastructure/persistence/entities/session.orm-entity.ts`             | Add `rpe` (integer nullable), `note` (text nullable) columns                                        |
| `backend/src/infrastructure/persistence/repositories/typeorm-session.repository.ts` | Update `findByUser` filter: `upcoming` = status IN ('planned','active','paused'), `all` = no filter |
| `backend/src/application/planning/get-sessions.use-case.ts`                         | Pass `statusFilter` instead of `onlyPlanned`                                                        |
| `backend/src/application/planning/get-sessions.use-case.spec.ts`                    | Update tests for renamed param                                                                      |
| `backend/src/interfaces/http/controllers/planning.controller.ts`                    | `all !== 'true'` → passes `'upcoming'` or `'all'` to use case                                       |
| `backend/src/interfaces/http/controllers/planning.controller.spec.ts`               | Update getSessions test                                                                             |
| `backend/src/app.module.ts`                                                         | Add `WorkoutLogOrmEntity` to entities array; import `ExecutionModule`                               |
| `backend/src/planning/planning.module.ts`                                           | No change (execution is its own module)                                                             |

## Implementation Phases

### Phase 1: Domain + ORM Entity

- `workout-log.ts` — domain interface
- `workout-log.repository.ts` — abstract class
- `workout-log.orm-entity.ts` — TypeORM entity (`workout_logs` table)
- `typeorm-workout-log.repository.ts` — impl (`findBySession`, `save`)
- Extend `Session` domain interface with `'paused'` status + `rpe`/`note` fields
- Update `SessionOrmEntity` with `rpe`/`note` columns

### Phase 2: Session repository + existing use-case updates

- Update `SessionRepository.findByUser` signature (`statusFilter`)
- Update `TypeOrmSessionRepository.findByUser` filter logic
- Add `SessionRepository.updateStatus(id, status): Promise<Session>` abstract method + impl
- Add `SessionRepository.saveOutcome(id, rpe, note): Promise<Session>` abstract method + impl
- Update `GetSessionsUseCase` + spec to pass `statusFilter`
- Update `PlanningController.getSessions` + spec

### Phase 3: Execution use cases

- `StartSessionUseCase` — validate `status === 'planned'`, call `updateStatus('active')`
- `PauseSessionUseCase` — validate `status === 'active'`, call `updateStatus('paused')`
- `ResumeSessionUseCase` — validate `status === 'paused'`, call `updateStatus('active')`
- `FinishSessionUseCase` — validate `status === 'active' || 'paused'`, call `saveOutcome(rpe, note)` + `updateStatus('completed')`
- `LogSetUseCase` — validate session `status === 'active'`, validate `sessionExerciseId` belongs to session, call `workoutLogRepository.save(...)`
- `GetSetsUseCase` — `workoutLogRepository.findBySession(sessionId)`, check `userId` matches
- Unit specs for all 6 use cases

### Phase 4: HTTP layer + wiring

- `FinishSessionDto` — `@IsOptional @IsInt @Min(1) @Max(10)` for `rpe`; `@IsOptional @IsString @MaxLength(1000)` for `note`
- `LogSetDto` — `@IsUUID sessionExerciseId`; `@IsInt @Min(1) setNumber`; optional `repsCompleted`, `weightKg`, `durationSeconds`
- `ExecutionController` — 6 route handlers, same `@CurrentUser` pattern
- `ExecutionModule` — `TypeOrmModule.forFeature([SessionOrmEntity, SessionExerciseOrmEntity, WorkoutLogOrmEntity])`, all use cases, `WorkoutLogRepository` binding
- `AppModule` — add `WorkoutLogOrmEntity` + `ExecutionModule`
- Controller spec

## Test Strategy

- **Mocking approach**: Jest with manual mocks (same pattern as all F-005 use cases — `jest.fn()` on abstract repo methods, `createMock()` pattern via NestJS testing utils)
- **Happy paths**: Each state transition use case returns updated session with correct status; `LogSetUseCase` returns created WorkoutLog; `GetSetsUseCase` returns array
- **Error scenarios**: 404 on wrong user; 409 on invalid transition (start active, pause planned, finish completed); 409 log set on non-active session; 400 on invalid DTO (rpe = 0, rpe = 11)
- **Edge cases**: finish from `paused` (OQ-2); empty sets list returns `[]`; `weightKg = 0` is valid (bodyweight)

## Risk & Complexity

- **Estimated complexity**: Low-Medium
- **Key risks**: `findByUser` param rename may break planning.controller if not updated atomically — handle in Phase 2 as one unit
- **New dependencies**: None
