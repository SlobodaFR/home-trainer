# Spec: Session Execution — Data Layer

**Track ID**: 007-session-execution-data
**Roadmap ref**: F-007
**Status**: Complete
**Created**: 2026-07-06
**Branch**: feat/007-session-execution-data
**PRD sections**: FR-4, FR-5, FR-7
**Depends on**: F-005 (Complete)

## Context

F-005 delivered the planning layer: `Session` entity with `status: 'planned' | 'active' | 'completed'`, `SessionExercise` with exercise metadata. F-007 builds the execution engine on top of it: a state machine to transition sessions through `planned → active → paused → completed`, a `WorkoutLog` entity to record each set with reps/weight/timestamp, and the REST endpoints that the execution UI (F-008) will consume.

This is a pure backend feature — no frontend changes.

## User Stories

- As a user, I want to start a planned session so its status changes to active
- As a user, I want to log a set (reps, weight, timestamp) during a session so progress is persisted
- As a user, I want to pause and resume a session so I can take breaks
- As a user, I want to finish a session with a perceived effort rating and optional note so the system can trigger analysis
- As a user, I want to stop a session early (partial save) so logs already recorded are kept

## Functional Requirements

### FR-1: Session state machine

Transitions:

- `planned → active`: `POST /sessions/:id/start`
- `active → paused`: `POST /sessions/:id/pause`
- `paused → active`: `POST /sessions/:id/resume`
- `active → completed`: `POST /sessions/:id/finish` (requires RPE + optional note)
- `active → completed` (early stop): `POST /sessions/:id/finish` (same endpoint, RPE optional for partial)

Invalid transitions must return `409 Conflict`.

Existing `status` column on `SessionOrmEntity` (`'planned' | 'active' | 'completed'`) is extended with `'paused'`. Domain interface `Session.status` updated accordingly.

### FR-2: WorkoutLog entity

Each logged set is a `WorkoutLog` record:

| Field               | Type            | Notes                                     |
| ------------------- | --------------- | ----------------------------------------- |
| `id`                | uuid            | PK                                        |
| `sessionId`         | text            | FK to sessions                            |
| `sessionExerciseId` | text            | FK to session_exercises                   |
| `userId`            | text            | Denormalized for fast user-scoped queries |
| `setNumber`         | integer         | 1-indexed set number within the exercise  |
| `repsCompleted`     | integer \| null | null for timed exercises                  |
| `weightKg`          | float \| null   | Optional, null if bodyweight              |
| `durationSeconds`   | integer \| null | For timed exercises (null for rep-based)  |
| `completedAt`       | datetime        | UTC, server-side timestamp                |

### FR-3: REST endpoints

| Method | Path                   | Body                                                                            | Response       | Notes                                                  |
| ------ | ---------------------- | ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ |
| `POST` | `/sessions/:id/start`  | —                                                                               | `Session`      | 404 if not found/wrong user; 409 if not `planned`      |
| `POST` | `/sessions/:id/pause`  | —                                                                               | `Session`      | 409 if not `active`                                    |
| `POST` | `/sessions/:id/resume` | —                                                                               | `Session`      | 409 if not `paused`                                    |
| `POST` | `/sessions/:id/finish` | `{ rpe?: number (1–10), note?: string }`                                        | `Session`      | 409 if not `active` or `paused`                        |
| `POST` | `/sessions/:id/sets`   | `{ sessionExerciseId, setNumber, repsCompleted?, weightKg?, durationSeconds? }` | `WorkoutLog`   | 404 if session not active; 409 if session not `active` |
| `GET`  | `/sessions/:id/sets`   | —                                                                               | `WorkoutLog[]` | Returns all sets for the session; user-scoped          |

### FR-4: Post-finish hook (placeholder)

`FinishSessionUseCase` marks session `completed` and persists RPE + note on `SessionOrmEntity`. It does NOT dispatch an LLM job — that belongs to F-009. Add `rpe: number | null` and `note: string | null` columns to `sessions` table now.

## API Endpoints Involved

| Method | Path                 | Purpose                     |
| ------ | -------------------- | --------------------------- |
| POST   | /sessions/:id/start  | Transition planned → active |
| POST   | /sessions/:id/pause  | Transition active → paused  |
| POST   | /sessions/:id/resume | Transition paused → active  |
| POST   | /sessions/:id/finish | Transition active           | paused → completed, save RPE + note |
| POST   | /sessions/:id/sets   | Log a set                   |
| GET    | /sessions/:id/sets   | List all sets for a session |

## Error Scenarios

- Start non-existent/wrong-user session → `404 Not Found`
- Invalid state transition (e.g., start an active session) → `409 Conflict`
- Log set when session not `active` → `409 Conflict`
- `rpe` out of range (not 1–10) → `400 Bad Request` (class-validator)
- `setNumber` < 1 → `400 Bad Request`
- `sessionExerciseId` not in session → `404 Not Found`

## Acceptance Criteria

- [ ] AC-1: `POST /sessions/:id/start` transitions `planned → active`; returns updated session; 409 if already active/paused/completed
- [ ] AC-2: `POST /sessions/:id/pause` transitions `active → paused`; 409 if not active
- [ ] AC-3: `POST /sessions/:id/resume` transitions `paused → active`; 409 if not paused
- [ ] AC-4: `POST /sessions/:id/finish` transitions `active|paused → completed`; persists `rpe` + `note`; 409 if already completed or planned
- [ ] AC-5: `POST /sessions/:id/sets` creates a `WorkoutLog` record; returns it; 409 if session not `active`
- [ ] AC-6: `GET /sessions/:id/sets` returns all logs for the session, ordered by `completedAt ASC`
- [ ] AC-7: All state transition endpoints return `404` for unknown or wrong-user session
- [ ] AC-8: Invalid transition returns `409 Conflict` (not 500)
- [ ] AC-9: Session with `status = 'paused'` included in `GET /sessions` response for the dashboard
- [ ] AC-10: All new endpoints are covered by unit tests (controller spec + use-case specs)

## Out of Scope

- Rest timer logic (frontend, F-008)
- LLM job dispatch on finish (F-009)
- Session execution UI (F-008)
- Editing or deleting logged sets
- `GET /sessions/:id` change — already returns full session with exercises (no sets yet; sets via dedicated endpoint)

## Open Questions

- **OQ-1**: Should `GET /sessions` (dashboard list) include `active` and `paused` sessions, or only `planned`? (Assumption: include `active` and `paused` — user needs to see in-progress sessions on dashboard. Change `onlyPlanned` filter to `onlyUpcoming = ['planned', 'active', 'paused']` vs `all = any status`)
- **OQ-2**: Should `finish` be allowed from `paused` state (partial stop)? (Assumption: yes — user should be able to finish from either `active` or `paused`)
- **OQ-3**: `weightKg` — float or integer? (Assumption: float, stored as REAL in SQLite, supports 0.5kg increments)
