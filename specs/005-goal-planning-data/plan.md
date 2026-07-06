# Plan: Goal & Planning — Data Layer

**Spec**: specs/005-goal-planning-data/spec.md

## Architecture Decisions

### AD-1: PlannerService lives in the application layer, not domain

- **Choice**: `@Injectable()` class in `application/planning/` that depends on `ExerciseRepository` and `UserExerciseRepository`
- **Rationale**: The planner needs enriched exercise data (isFavorite, preferenceWeight) from injected repositories — a pure domain function can't hold those deps. Keeping it in application layer follows the existing pattern (use cases = application layer services with injected repositories)
- **Alternatives considered**: Pure domain function (can't inject), separate infrastructure service (overkill, no I/O needed beyond reading exercises)

### AD-2: Session exercises stored in a separate table (not simple-json on Session)

- **Choice**: `session_exercises` table with FK to `sessions`
- **Rationale**: F-007 (session execution) needs to iterate and update individual exercises/sets during a session. Storing as simple-json would make partial updates messy and block future querying. Slight extra join complexity is worth it.
- **Alternatives considered**: `simple-json` on Session row (simpler now, blocks F-007)

### AD-3: availabilityDays and availableEquipment stored as simple-json

- **Choice**: `@Column({ type: 'simple-json' })` — same as `muscleGroups` and `equipment` on ExerciseOrmEntity
- **Rationale**: Consistent with existing codebase pattern for SQLite arrays; no separate join table needed
- **Alternatives considered**: Comma-separated text, relational join table (overkill for single-user)

### AD-4: PlanningModule provides its own ExerciseRepository bindings

- **Choice**: `PlanningModule` imports `TypeOrmModule.forFeature([ExerciseOrmEntity, UserExerciseOrmEntity])` and provides `TypeOrmExerciseRepository` and `TypeOrmUserExerciseRepository` locally
- **Rationale**: ExerciseModule does not currently export its repositories. Re-registering TypeORM entities in a second module is idempotent in TypeORM. Avoids adding cross-module exports/imports for now — ExerciseModule refactor belongs to a later cleanup.
- **Alternatives considered**: Export repos from ExerciseModule and import ExerciseModule (cleaner long-term, but requires modifying F-004 code mid-stream)

### AD-5: Date arithmetic with native Date, no date-fns

- **Choice**: Native `Date` arithmetic to generate session dates from `activeFrom` + `horizonWeeks` + `availabilityDays`
- **Rationale**: date-fns not in dependencies; date generation here is simple (iterate days, check weekday); adding a dep for ~15 lines of arithmetic is unnecessary
- **Alternatives considered**: date-fns (heavier dep), dayjs (same concern)

### AD-6: plannedDate stored as ISO 8601 text (YYYY-MM-DD)

- **Choice**: `@Column({ type: 'text', name: 'planned_date' })`, stored as `'2026-07-14'`
- **Rationale**: better-sqlite3 has no native `DATE` type. Using text avoids timezone drift that `datetime` columns introduce. Lexicographic sort of ISO dates matches chronological order — no special handling needed.
- **Alternatives considered**: Unix timestamp integer (less readable), `datetime` (timezone issues with better-sqlite3)

### AD-7: Goal isActive stored as integer (0/1) — same SQLite boolean pattern

- **Choice**: `@Column({ type: 'integer', name: 'is_active', default: 0 })`
- **Rationale**: Consistent with `isFavorite` in UserExerciseOrmEntity; `boolean` columns in better-sqlite3 are unreliable
- **Alternatives considered**: boolean TypeORM column (unreliable in SQLite)

## Affected Files

### New Files

| File                                                                                | Purpose                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `backend/src/domain/planning/goal.ts`                                               | Goal domain interface                                                                       |
| `backend/src/domain/planning/session.ts`                                            | Session domain interface (with nested SessionExercise[])                                    |
| `backend/src/domain/planning/session-exercise.ts`                                   | SessionExercise domain interface                                                            |
| `backend/src/domain/planning/goal.repository.ts`                                    | Abstract GoalRepository                                                                     |
| `backend/src/domain/planning/session.repository.ts`                                 | Abstract SessionRepository                                                                  |
| `backend/src/application/planning/planner.service.ts`                               | Equipment-aware session planner                                                             |
| `backend/src/application/planning/planner.service.spec.ts`                          | Planner unit tests                                                                          |
| `backend/src/application/planning/create-goal.use-case.ts`                          | Save goal, deactivate previous, call planner, persist sessions                              |
| `backend/src/application/planning/create-goal.use-case.spec.ts`                     |                                                                                             |
| `backend/src/application/planning/get-active-goal.use-case.ts`                      | Return active goal or null                                                                  |
| `backend/src/application/planning/get-active-goal.use-case.spec.ts`                 |                                                                                             |
| `backend/src/application/planning/get-sessions.use-case.ts`                         | List sessions by status                                                                     |
| `backend/src/application/planning/get-sessions.use-case.spec.ts`                    |                                                                                             |
| `backend/src/application/planning/get-session-by-id.use-case.ts`                    | Single session with exercises                                                               |
| `backend/src/application/planning/get-session-by-id.use-case.spec.ts`               |                                                                                             |
| `backend/src/application/planning/replan-session.use-case.ts`                       | Regenerate exercises for a planned session                                                  |
| `backend/src/application/planning/replan-session.use-case.spec.ts`                  |                                                                                             |
| `backend/src/infrastructure/persistence/entities/goal.orm-entity.ts`                | goals table                                                                                 |
| `backend/src/infrastructure/persistence/entities/session.orm-entity.ts`             | sessions table                                                                              |
| `backend/src/infrastructure/persistence/entities/session-exercise.orm-entity.ts`    | session_exercises table                                                                     |
| `backend/src/infrastructure/persistence/repositories/typeorm-goal.repository.ts`    | GoalRepository implementation                                                               |
| `backend/src/infrastructure/persistence/repositories/typeorm-session.repository.ts` | SessionRepository implementation                                                            |
| `backend/src/interfaces/http/controllers/planning.controller.ts`                    | POST /goals, GET /goals/active, GET /sessions, GET /sessions/:id, POST /sessions/:id/replan |
| `backend/src/interfaces/http/controllers/planning.controller.spec.ts`               | Controller unit tests                                                                       |
| `backend/src/interfaces/http/dto/create-goal.dto.ts`                                | Validated DTO (type, target, horizon, availability, equipment, duration)                    |
| `backend/src/planning/planning.module.ts`                                           | NestJS module wiring                                                                        |

### Modified Files

| File                        | Change                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `backend/src/app.module.ts` | Add GoalOrmEntity, SessionOrmEntity, SessionExerciseOrmEntity to entities list; import PlanningModule |

## Implementation Phases

### Phase 1: Domain interfaces + ORM entities + repositories

Core data structures — everything else builds on this.

- `domain/planning/goal.ts` — `Goal` interface: `{ id, userId, type, targetDescription, horizonWeeks, availabilityDays, sessionDurationMinutes, availableEquipment, activeFrom, isActive, createdAt }`
- `domain/planning/session-exercise.ts` — `SessionExercise`: `{ id, sessionId, exerciseId, exerciseName, order, sets, repsOrDuration }`
- `domain/planning/session.ts` — `Session`: `{ id, userId, goalId, plannedDate, status, createdAt, exercises: SessionExercise[] }`
- `domain/planning/goal.repository.ts` — `abstract GoalRepository { findActiveByUser, save, deactivateAllForUser }`
- `domain/planning/session.repository.ts` — `abstract SessionRepository { findByUser, findById, saveAll, deleteExercisesForSession, saveExercises }`
- `infrastructure/.../goal.orm-entity.ts` — `goals` table
- `infrastructure/.../session.orm-entity.ts` — `sessions` table (`@OneToMany` to SessionExerciseOrmEntity)
- `infrastructure/.../session-exercise.orm-entity.ts` — `session_exercises` table (`@ManyToOne` to SessionOrmEntity)
- `infrastructure/.../typeorm-goal.repository.ts` + `typeorm-session.repository.ts`

### Phase 2: Application layer — PlannerService + use cases

Business logic: planner algorithm, goal creation flow, session queries.

- `application/planning/planner.service.ts`
  - `generateSessions(goal: Goal, exercises: ExerciseWithPreference[]): Array<{ plannedDate: string, exercises: { exerciseId, exerciseName, order, sets, repsOrDuration }[] }>`
  - Date generation: iterate days from `activeFrom` for `horizonWeeks` weeks, collect days matching `availabilityDays`
  - Per session: filter exercises by equipment ∩ `availableEquipment`, sort (isFavorite DESC, preferenceWeight DESC NULLS LAST, shuffle tail), slice to budget (`floor(sessionDurationMinutes / 5)`, min 1)
- `application/planning/planner.service.spec.ts` — test equipment filter, ordering, budget, empty-equipment fallback
- `create-goal.use-case.ts`: deactivate previous → save goal → load exercises with preferences → call planner → persist sessions → return goal
- `get-active-goal.use-case.ts`: `findActiveByUser` → return or null
- `get-sessions.use-case.ts`: `findByUser(userId, { all?: boolean })` → order by `plannedDate` ASC
- `get-session-by-id.use-case.ts`: `findById` → return null if not found or belongs to different user
- `replan-session.use-case.ts`: load session → 409 if not `planned` → delete old exercises → call planner for single date → persist new exercises → return updated session

### Phase 3: HTTP layer + wiring

Controllers, DTOs, module, app.module update.

- `create-goal.dto.ts`:
  - `type`: `@IsIn(['strength', 'mobility', 'endurance', 'general'])`
  - `targetDescription`: `@IsString() @MaxLength(500)`
  - `horizonWeeks`: `@IsInt() @Min(1) @Max(52)`
  - `availabilityDays`: `@IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) @ArrayMinSize(1)`
  - `sessionDurationMinutes`: `@IsInt() @Min(20) @Max(120)`
  - `availableEquipment`: `@IsArray() @IsString({ each: true })`
  - `activeFrom`: `@IsDateString() @IsOptional()` (defaults to today if absent)
- `planning.controller.ts` — all 5 endpoints, `@CurrentUser()` on all, `@HttpCode(204)` not needed here
- `planning.controller.spec.ts` — mock all use cases, test happy paths + 409 + 404
- `planning.module.ts` — wire all use cases + repos + PlannerService
- `app.module.ts` — add 3 entities + PlanningModule

## Test Strategy

- **Mocking approach**: `Test.createTestingModule` with `jest.fn()` mocks — same as existing tests. No real DB. `PlannerService` unit-tested directly (pure inputs, no DB deps).
- **Happy paths**: `POST /goals` → sessions created; `GET /sessions` → ordered list; `POST /sessions/:id/replan` → exercises replaced
- **Error scenarios**: replan active session → 409; getSessionById wrong user → null → 404; empty equipment → bodyweight fallback
- **Edge cases**: `horizonWeeks = 1` with no matching weekdays in that week (0 sessions → 422); `availableEquipment = []` → bodyweight-only exercises

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**: Equipment filtering correctness — `exercise.equipment` is a simple-json array of strings; intersection with `availableEquipment` must be case-insensitive or exact-match. Plan: exact match (same strings as Wger import produces).
- **New dependencies**: None
