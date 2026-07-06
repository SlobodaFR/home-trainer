# Spec: Goal & Planning — UI

**Track ID**: 006-goal-planning-ui
**Roadmap ref**: F-006
**Status**: Complete
**Created**: 2026-07-06
**Branch**: feat/006-goal-planning-ui
**PRD sections**: FR-1, FR-2, FR-3
**Depends on**: F-002 (Complete), F-005 (Complete)

## Context

F-005 shipped the entire planning backend — Goal entity, PlannerService, 5 REST endpoints. This feature
builds the frontend that consumes it: a dashboard home screen showing the active goal and upcoming sessions,
a goal creation form, and per-session detail + replan capability. It is the first feature with a "home"
screen; `App.tsx` currently redirects `/` to `/exercises`.

## User Stories

- As a user, I want to see my upcoming sessions on the home screen so I know what to train next
- As a user, I want to define a training goal through a form so the system can plan sessions for me
- As a user, I want to see the exercises in a session detail so I know what to prepare
- As a user, I want to replan a session so the exercise selection adapts to my day

## Functional Requirements

### FR-1: Dashboard (Home screen)

Route `/` (previously redirected to `/exercises`) becomes the planning dashboard.

**Active goal panel** — shows at top:

- Goal type badge (strength / mobility / endurance / general)
- `targetDescription` text
- Horizon and session duration (`4 weeks · 60 min`)
- "Change goal" button → opens goal creation form (replaces current goal)

**No-goal empty state** — when no active goal:

- Illustration/copy: "Aucun objectif actif"
- `button-primary`: "Définir un objectif" → opens goal creation form

**Upcoming sessions list** — below the goal panel:

- Calls `GET /api/sessions` (planned only)
- Each row: `plannedDate` formatted as weekday + date (`Lundi 7 juil.`), session exercise count, "Voir" button → `/sessions/:id`
- Empty state: "Aucune séance planifiée" if goal exists but session list is empty

### FR-2: Goal creation form

Route `/goals/new` (also rendered inline as a sheet/modal overlay from the dashboard).

Fields:

- `type`: 4 pill-toggle options (Force / Mobilité / Endurance / Général)
- `targetDescription`: text input, placeholder "Ex: améliorer le squat"
- `horizonWeeks`: slider or stepper, 1–12 (limit to reasonable range for UX)
- `availabilityDays`: 7 day-of-week checkboxes (L M M J V S D)
- `sessionDurationMinutes`: stepper 20–120 step 5
- `availableEquipment`: multi-select chips from the equipment vocabulary used in the exercise library

On submit:

- `POST /api/goals` → on success, redirect to `/` and show toast "Objectif enregistré, séances planifiées"
- Previous goal is silently deactivated by the backend
- Optimistic: form disabled during request; on error show toast "Erreur, réessayez"

### FR-3: Session detail page

Route `/sessions/:id`.

Displays:

- `plannedDate` formatted header
- Ordered list of `SessionExercise` rows: exercise name, sets × repsOrDuration
- "Replanifier" button (only shown when `status === 'planned'`)
  - Calls `POST /api/sessions/:id/replan`
  - Optimistic: button shows spinner; on success replace exercise list with updated data + toast "Séance replanifiée"
  - On 409: toast "Cette séance ne peut pas être replanifiée"
  - On error: toast "Erreur, réessayez"

## API Endpoints Involved

| Method | Path                     | Purpose                                    |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | /api/goals/active        | Load active goal for dashboard panel       |
| POST   | /api/goals               | Create new goal + trigger planning         |
| GET    | /api/sessions            | List upcoming planned sessions             |
| GET    | /api/sessions/:id        | Load session detail with exercises         |
| POST   | /api/sessions/:id/replan | Regenerate exercises for a planned session |

## Design References

| Surface        | Components used                                                                                       | New components needed                                        |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Dashboard      | `button-primary`, `button-secondary`, `filter-chip`, `filter-chip-active`                             | `session-row` (date + count + CTA), `goal-panel`             |
| Goal form      | `button-primary`, `button-secondary`, `filter-chip`, `filter-chip-active`, `search-pill` (text input) | `day-picker` (7-day row), `stepper`, `equipment-multiselect` |
| Session detail | `button-primary`, `button-secondary`                                                                  | `exercise-row` (name + sets/reps)                            |

> No new tokens needed — all surfaces use existing palette and spacing.

## Error Scenarios

- `GET /api/goals/active` → 404: render no-goal empty state (not an error, expected)
- `GET /api/sessions` → error: show "Impossible de charger les séances" inline error with retry
- `POST /api/goals` → 400 (validation): surface field errors below each input
- `POST /api/sessions/:id/replan` → 409: toast "Cette séance ne peut pas être replanifiée"
- Any network error: toast "Erreur réseau, réessayez"

## Acceptance Criteria

- [ ] AC-1: `/` shows active goal panel with type, description, horizon, duration; "Change goal" navigates to form
- [ ] AC-2: `/` shows "Aucun objectif actif" + "Définir un objectif" CTA when no goal exists
- [ ] AC-3: Upcoming sessions list renders below goal panel, ordered by date, with session exercise count
- [ ] AC-4: Empty session list shows "Aucune séance planifiée" message
- [ ] AC-5: `/goals/new` form has all 6 fields with correct input types and validation
- [ ] AC-6: Goal form submission calls `POST /api/goals`, redirects to `/` on success with toast
- [ ] AC-7: `/sessions/:id` shows plannedDate header + ordered exercise list
- [ ] AC-8: "Replanifier" button on planned session calls replan endpoint, refreshes exercises on success
- [ ] AC-9: "Replanifier" button hidden when session status is not `planned`
- [ ] AC-10: All loading states show a skeleton or spinner; no layout shift on load

## Out of Scope

- Session execution (start/pause/stop/log sets) — F-008
- Session rescheduling (changing date) — not in F-005 backend
- Editing an existing goal (only creation supported; "change" creates new one)
- Equipment vocabulary management (uses same strings as exercise library)
- Notifications / push alerts for planned sessions

## Open Questions

- **OQ-1**: Goal form as separate route `/goals/new` or modal overlay on dashboard? (Assumption: separate route — simpler navigation, back button works naturally)
- **OQ-2**: Equipment multiselect — free-text or fixed vocabulary? (Assumption: fixed vocabulary matching F-004 filter chips: Barbell, Dumbbell, Cable, Machine, Bodyweight, Kettlebell, Resistance Band)
- **OQ-3**: `horizonWeeks` max cap in form — 52 (spec) is too long for UX. (Assumption: cap at 12 in form, backend accepts up to 52)
