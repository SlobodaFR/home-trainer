# Spec: Goal & Planning — Data Layer

**Track ID**: 005-goal-planning-data
**Roadmap ref**: F-005
**Status**: Complete
**Created**: 2026-07-06
**Branch**: feat/005-goal-planning-data
**PRD sections**: FR-1, FR-2, FR-3
**Depends on**: F-003 (Complete)

## Context

Users need sessions auto-generated from a goal and weekly availability. This feature delivers the entire backend — entities, planning logic, and REST endpoints — that F-006 (Planning UI) will consume. No frontend work here.

The planner is rule-based (no LLM). It respects equipment constraints (only exercises whose required equipment is in the user's declared set) and preference weights (higher-weighted exercises appear more often). Favorites surface first. Sessions are generated for the next N days on goal save; individual sessions can be replanned on demand.

## User Stories

- As a user, I want to save a training goal so the system knows what I'm working toward
- As a user, I want sessions auto-scheduled for my availability so I don't have to plan manually
- As a user, I want sessions to use equipment I actually have so I never see an unusable exercise
- As a user, I want to request a replan of a specific session so planning adapts to my day

## Functional Requirements

### FR-1: Goal definition

User creates a goal with:

- `type`: enum — `strength` | `mobility` | `endurance` | `general`
- `targetDescription`: free text (e.g., "improve squat strength")
- `horizonWeeks`: integer, 1–52
- `availabilityDays`: array of weekday numbers (0=Sunday … 6=Saturday)
- `sessionDurationMinutes`: integer, 20–120
- `availableEquipment`: array of equipment strings (drawn from exercise library vocabulary)
- `activeFrom`: date (defaults to today)

Only one active goal per user at a time. Creating a new goal deactivates the previous one.

### FR-2: Session auto-planning

On goal save, system generates sessions from `activeFrom` for `horizonWeeks` weeks, one per `availabilityDay`.
Each session:

- `plannedDate`: date of the session
- `status`: `planned` (initial)
- `exercises`: list of `SessionExercise` rows — exercise selected by planner, ordered, with suggested `sets` and `repsOrDuration`

Planner algorithm:

1. Filter exercises: equipment ∩ `availableEquipment` (empty equipment list = bodyweight only)
2. Sort by: isFavorite DESC, preferenceWeight DESC NULLS LAST, then random
3. Pick top N exercises to fill `sessionDurationMinutes` (budget: ~5 min per exercise)
4. Assign default sets/reps from exercise data or fallback (3 sets × 10 reps)

### FR-3: Session replanning

`POST /sessions/:id/replan` regenerates the exercises for that session using the same algorithm. Session must have status `planned`; active/completed sessions cannot be replanned.

### FR-4: Upcoming sessions query

`GET /sessions` returns sessions for the current user, ordered by `plannedDate` ASC, filtered to `status = planned` by default. Query param `?all=true` returns all statuses.

## API Endpoints

| Method | Path                     | Purpose                                            |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | /api/goals               | Create goal, deactivate previous, trigger planning |
| GET    | /api/goals/active        | Get current active goal                            |
| GET    | /api/sessions            | List sessions (planned by default)                 |
| GET    | /api/sessions/:id        | Get single session with exercises                  |
| POST   | /api/sessions/:id/replan | Replan a single planned session                    |

## Error Scenarios

- `POST /goals` with invalid `availabilityDays` (empty or out of range 0–6) → 400
- `POST /sessions/:id/replan` on active/completed session → 409 Conflict
- Goal horizon yields 0 sessions (e.g., horizon 1 week, no matching weekdays) → 422 with message
- No exercises match equipment filter → planner falls back to bodyweight exercises; if still empty, 422

## Acceptance Criteria

- [ ] AC-1: `POST /api/goals` saves goal, deactivates previous active goal, returns created goal
- [ ] AC-2: Sessions are generated for each `availabilityDay` over `horizonWeeks` weeks
- [ ] AC-3: Each session contains only exercises whose equipment is in `availableEquipment`
- [ ] AC-4: Exercises within a session are ordered: favorites first, then by preference weight
- [ ] AC-5: `GET /api/sessions` returns upcoming planned sessions in date order
- [ ] AC-6: `GET /api/sessions/:id` returns session with full exercise list
- [ ] AC-7: `POST /api/sessions/:id/replan` regenerates exercises for a planned session
- [ ] AC-8: Replanning an active or completed session returns 409
- [ ] AC-9: `GET /api/goals/active` returns the current active goal (or 404 if none)
- [ ] AC-10: All endpoints require authentication

## Out of Scope

- Session execution (start/pause/stop/log) — F-007
- Frontend UI — F-006
- LLM-based planning — rule-based only for now
- Push/email notification of new sessions
- Calendar sync (iCal, Google Calendar)
- Multi-goal support (only one active at a time)

## Open Questions

- **OQ-1**: Should replanning respect the original `plannedDate`, or allow rescheduling to a different date? (Assumption: keep date, regenerate exercises only)
- **OQ-2**: Should `availableEquipment` be stored on the Goal, or as a separate user profile field shared across goals? (Assumption: stored on Goal — explicit per-goal)
- **OQ-3**: `sessionDurationMinutes` budget: should partial-minute exercises be rounded or truncated? (Assumption: floor, add one more exercise if budget allows)
