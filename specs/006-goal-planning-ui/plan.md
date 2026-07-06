# Plan: Goal & Planning — UI

**Spec**: specs/006-goal-planning-ui/spec.md

## Architecture Decisions

### AD-1: planning-client.ts mirrors exercise-client.ts pattern

- **Choice**: New `frontend/src/infrastructure/planning-client.ts` with typed domain interfaces (`Goal`, `Session`, `SessionExercise`) and one function per API endpoint (`getActiveGoal`, `createGoal`, `listSessions`, `getSession`, `replanSession`)
- **Rationale**: All existing API calls follow the single-file-per-domain client pattern with a shared `request<T>()` helper. Consistent with exercise-client.ts — no abstraction layer, no hooks library.
- **Alternatives considered**: React Query / SWR (too heavy for this scale), centralised api-client.ts (mixes domains)

### AD-2: Local state + fetch in components — no external state library

- **Choice**: `useState` + `useEffect` per page component, same as ExercisesPage and ExerciseDetailPage
- **Rationale**: All existing pages use this pattern. Single user, no cross-page shared state needed. Adding Redux/Zustand for 3 pages would be overkill.
- **Alternatives considered**: Zustand (reasonable, but no existing usage — introduce later if needed)

### AD-3: Dashboard as new HomePage, `/` no longer redirects to `/exercises`

- **Choice**: New `DashboardPage` at route `/`. `App.tsx` updated to render `DashboardPage` at index. Nav bar added to link `/`, `/exercises`.
- **Rationale**: The PRD's home screen is the planning dashboard. Current redirect to exercises was a placeholder.
- **Alternatives considered**: Keep `/exercises` as home and add `/dashboard` (breaks expected UX)

### AD-4: Goal form as separate route `/goals/new`, not modal

- **Choice**: `GoalFormPage` at `/goals/new`; "Définir un objectif" and "Changer d'objectif" both use `<Link>` to navigate there; success redirects back to `/`
- **Rationale**: OQ-1 assumption confirmed. Back button works, no z-index/scroll issues, simpler focus management for accessibility.
- **Alternatives considered**: Sheet/drawer overlay (more complex, no existing overlay component)

### AD-5: Equipment multiselect as multi-toggle FilterChips (multi-select variant)

- **Choice**: Reuse `FilterChips` styling but support multiple selected values via `string[]` instead of `string | undefined`. New `MultiFilterChips` component (or extend FilterChips with `multi` prop).
- **Rationale**: Design token `filter-chip`/`filter-chip-active` already in use. Fixed equipment vocabulary (Barbell, Dumbbell, Cable, Machine, Bodyweight, Kettlebell, Resistance Band) matches F-004.
- **Alternatives considered**: Checkboxes (different visual pattern), dropdown (worse discoverability)

### AD-6: Day picker as 7-button row (L M M J V S D)

- **Choice**: New `DayPicker` component — row of 7 pill buttons mapping to weekday indices 0–6 (Sun=0). Multi-select, same `filter-chip`/`filter-chip-active` styling.
- **Rationale**: Simple, touch-friendly, visually consistent. No library needed.
- **Alternatives considered**: Checkbox grid, calendar widget

### AD-7: Stepper component for horizonWeeks and sessionDurationMinutes

- **Choice**: New `Stepper` component — `−` / value / `+` buttons with min/max/step props.
- **Rationale**: Numeric inputs on mobile are annoying (`<input type="number">` is inconsistent across browsers). Stepper is more tactile.
- **Alternatives considered**: Range slider (imprecise for this use case), plain number input

### AD-8: Shared nav bar added in App.tsx

- **Choice**: Simple top nav with links to `/` (Accueil) and `/exercises` (Exercices), rendered inside `RequireAuth`. `active` state via `useLocation`.
- **Rationale**: Without nav, users have no way back to dashboard from exercises now that `/` is no longer exercises.
- **Alternatives considered**: Bottom tab bar (more mobile-native, but existing layout uses top header pattern)

## Affected Files

### New Files

| File                                                       | Purpose                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `frontend/src/infrastructure/planning-client.ts`           | API client for Goal/Session endpoints                               |
| `frontend/src/presentation/planning/DashboardPage.tsx`     | Home screen: goal panel + sessions list                             |
| `frontend/src/presentation/planning/GoalFormPage.tsx`      | Goal creation form                                                  |
| `frontend/src/presentation/planning/SessionDetailPage.tsx` | Session detail + replan                                             |
| `frontend/src/presentation/planning/goal-types.ts`         | `GOAL_TYPES` and `EQUIPMENT_OPTIONS` constants (react-refresh rule) |
| `frontend/src/presentation/shared/MultiFilterChips.tsx`    | Multi-select chip row (equipment, etc.)                             |
| `frontend/src/presentation/shared/DayPicker.tsx`           | 7-day weekday picker                                                |
| `frontend/src/presentation/shared/Stepper.tsx`             | +/- numeric stepper                                                 |
| `frontend/src/presentation/shared/NavBar.tsx`              | Top navigation bar                                                  |

### Modified Files

| File                   | Change                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/App.tsx` | Add DashboardPage route at `/`, add GoalFormPage at `/goals/new`, add SessionDetailPage at `/sessions/:id`, wrap routes in NavBar |

## Implementation Phases

### Phase 1: Infrastructure + shared components

Foundation: API client + reusable UI primitives that pages depend on.

- `planning-client.ts` — typed interfaces + 5 fetch functions
- `NavBar.tsx` — top nav with Home/Exercices links
- `MultiFilterChips.tsx` — multi-select chip row
- `DayPicker.tsx` — 7-day weekday selector
- `Stepper.tsx` — +/- numeric input
- `goal-types.ts` — `GOAL_TYPES` constant array + `EQUIPMENT_OPTIONS` (reuse from exercise-filters or duplicate for planning vocabulary)
- `App.tsx` update — add new routes + wrap in NavBar

### Phase 2: Pages

Build all three page components using Phase 1 primitives.

- `DashboardPage.tsx`
  - Fetches `GET /api/goals/active` (404 → empty state) + `GET /api/sessions`
  - Goal panel: type badge, description, horizon + duration, "Changer d'objectif" link
  - No-goal empty state: "Aucun objectif actif" + `button-primary` "Définir un objectif"
  - Session list rows: formatted date, exercise count, "Voir" link to `/sessions/:id`
  - Empty sessions state: "Aucune séance planifiée"
  - Loading skeletons for both panels
- `GoalFormPage.tsx`
  - Controlled form with all 6 fields
  - `type`: 4 pill-toggle (reuse FilterChips with single-select)
  - `targetDescription`: `<input type="text">`
  - `horizonWeeks`: `<Stepper min=1 max=12 step=1>`
  - `availabilityDays`: `<DayPicker>`
  - `sessionDurationMinutes`: `<Stepper min=20 max=120 step=5>`
  - `availableEquipment`: `<MultiFilterChips>`
  - Submit: `POST /api/goals` → navigate('/') + toast; error → toast
  - Disabled state during submit
- `SessionDetailPage.tsx`
  - Fetches `GET /api/sessions/:id`
  - Header: formatted plannedDate
  - Exercise list: ordered by `order`, each row: name, sets × repsOrDuration
  - "Replanifier" button: visible only when `status === 'planned'`
  - Replan flow: spinner → replace exercises + toast; 409 → specific toast

## Design Mobilization

- **Tokens used**: `{colors.ink}`, `{colors.canvas}`, `{colors.soft-cloud}`, `{colors.mute}`, `{spacing.sm}` (8px), `{spacing.lg}` (18px), `{spacing.xl}` (24px), `{spacing.section}` (48px), `{rounded.full}` (pill buttons), `{typography.heading-xl}` (page titles), `{typography.body-md}`, `{typography.button-md}`, `{typography.caption-md}`
- **Components used**: `button-primary` (submit, replan, définir objectif), `button-secondary` (changer d'objectif), `filter-chip`/`filter-chip-active` (goal type, equipment, day picker)
- **New components**: `MultiFilterChips` (multi-select variant of `FilterChips`), `DayPicker`, `Stepper`, `NavBar`, `session-row` (inline in DashboardPage), `exercise-row` (inline in SessionDetailPage)
- **Surfaces touched**: Dashboard (home), Goal form, Session detail
- **States covered**: loading (skeleton), empty (no goal, no sessions), error (inline + toast), success (toast on goal creation + replan)
- **A11y notes**: All form inputs have `<label>`. DayPicker buttons use `aria-pressed`. Stepper buttons have `aria-label`. NavBar uses `<nav>` with `aria-label="Navigation principale"`. Focus visible on all interactive elements.

## Test Strategy

- **Mocking approach**: Frontend has no test files yet (Vitest runs with `--passWithNoTests`). No tests written for this feature — consistent with existing codebase. Verified manually via dev server.
- **Happy paths**: Goal creation → redirect + toast; dashboard loads goal + sessions; replan updates exercise list
- **Error scenarios**: 404 on goals/active → empty state (not error); network error → toast; 409 on replan → specific toast
- **Edge cases**: Empty availabilityDays → form validation prevents submit; sessions list empty with active goal

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**: Date formatting — `plannedDate` is ISO `YYYY-MM-DD` string; French locale weekday label needs `Intl.DateTimeFormat` with timezone-safe parsing (use `T00:00:00` suffix to avoid UTC offset shift)
- **New dependencies**: None — Intl API is native
