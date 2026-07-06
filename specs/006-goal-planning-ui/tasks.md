# Tasks: Goal & Planning — UI

**Plan**: specs/006-goal-planning-ui/plan.md
**Status**: Complete
**Total**: 16 tasks across 2 phases

---

## Phase 1: Infrastructure + Shared Components

- [x] **T-1.1**: planning-client.ts — API client with typed interfaces
  - **Do**: Create `frontend/src/infrastructure/planning-client.ts`:
    - Export interfaces: `Goal { id, userId, type, targetDescription, horizonWeeks, availabilityDays, sessionDurationMinutes, availableEquipment, activeFrom, isActive, createdAt }`, `SessionExercise { id, sessionId, exerciseId, exerciseName, order, sets, repsOrDuration }`, `Session { id, userId, goalId, plannedDate, status, createdAt, exercises: SessionExercise[] }`, `CreateGoalInput { type, targetDescription, horizonWeeks, availabilityDays, sessionDurationMinutes, availableEquipment, activeFrom? }`
    - Copy the `request<T>()` helper from exercise-client.ts (same fetch/credentials/error pattern)
    - `getActiveGoal(): Promise<Goal | null>` — `GET /api/goals/active`, catches 404 → return null
    - `createGoal(data: CreateGoalInput): Promise<Goal>` — `POST /api/goals` with JSON body
    - `listSessions(): Promise<Session[]>` — `GET /api/sessions`
    - `getSession(id: string): Promise<Session>` — `GET /api/sessions/:id`
    - `replanSession(id: string): Promise<Session>` — `POST /api/sessions/:id/replan`
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors

- [x] **T-1.2**: goal-types.ts — constants for goal type labels and equipment vocabulary
  - **Do**: Create `frontend/src/presentation/planning/goal-types.ts`:
    - `export const GOAL_TYPE_OPTIONS: { value: 'strength' | 'mobility' | 'endurance' | 'general'; label: string }[] = [{ value: 'strength', label: 'Force' }, { value: 'mobility', label: 'Mobilité' }, { value: 'endurance', label: 'Endurance' }, { value: 'general', label: 'Général' }]`
    - `export const PLANNING_EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Resistance Band']`
    - `export const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']` (index 0=Sunday)
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors

- [x] **T-1.3**: NavBar.tsx — top navigation bar
  - **Do**: Create `frontend/src/presentation/shared/NavBar.tsx`:
    - `<nav aria-label="Navigation principale">` with two `<NavLink>` from react-router-dom
    - Links: `{ to: '/', label: 'Accueil' }` and `{ to: '/exercises', label: 'Exercices' }`
    - Active link: `font-medium text-ink underline`, inactive: `text-mute`
    - Layout: `flex gap-6 px-4 py-3 bg-canvas border-b border-hairline` (add `hairline: '#cacacb'` to tailwind config)
    - Use NavLink's `className` prop with isActive callback
  - **Test**: Dev server renders nav above page content — verify `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-1.4**: MultiFilterChips.tsx — multi-select chip row
  - **Do**: Create `frontend/src/presentation/shared/MultiFilterChips.tsx`:
    - Props: `{ options: string[]; selected: string[]; onChange: (values: string[]) => void }`
    - Toggle logic: if value in selected → remove, else → add
    - Same chip styling as `FilterChips.tsx`: active = `bg-ink text-canvas`, inactive = `border border-gray-300 text-ink`
    - Each button: `aria-pressed={selected.includes(option)}`
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors

- [x] **T-1.5**: DayPicker.tsx — 7-day weekday picker
  - **Do**: Create `frontend/src/presentation/shared/DayPicker.tsx`:
    - Props: `{ selected: number[]; onChange: (days: number[]) => void }`
    - Renders 7 pill buttons using `DAY_LABELS` from `goal-types.ts` (import from `../planning/goal-types`)
    - Day index 0=Sunday … 6=Saturday
    - Toggle logic: same as MultiFilterChips — add/remove index
    - Button `aria-pressed={selected.includes(index)}`
    - Same chip styling as FilterChips
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors

- [x] **T-1.6**: Stepper.tsx — +/- numeric stepper
  - **Do**: Create `frontend/src/presentation/shared/Stepper.tsx`:
    - Props: `{ value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; label?: string }`
    - Renders: `<button aria-label="Diminuer">−</button>` / `<span>{value}</span>` / `<button aria-label="Augmenter">+</button>`
    - `−` disabled when `value <= min`, `+` disabled when `value >= max`
    - Styling: inline-flex items-center gap-3; buttons = `w-8 h-8 rounded-full bg-soft-cloud text-ink font-medium disabled:opacity-30`
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors

- [x] **T-1.7**: App.tsx — add new routes + NavBar
  - **Do**: Modify `frontend/src/App.tsx`:
    - Import `DashboardPage`, `GoalFormPage`, `SessionDetailPage`, `NavBar`
    - Replace `<Route index element={<Navigate to="/exercises" replace />} />` with `<Route index element={<DashboardPage />} />`
    - Add `<Route path="goals/new" element={<GoalFormPage />} />`
    - Add `<Route path="sessions/:id" element={<SessionDetailPage />} />`
    - Wrap the inner `<Routes>` with `<><NavBar /><Routes>…</Routes></>`
    - Add `tailwind.config.ts`: add `hairline: '#cacacb'` to colors extend
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors

---

## Phase 2: Pages

- [x] **T-2.1**: DashboardPage.tsx — goal panel (active goal + no-goal empty state)
  - **Do**: Create `frontend/src/presentation/planning/DashboardPage.tsx` — first half:
    - `useState` for `goal: Goal | null`, `goalLoading: boolean`, `goalError: string | null`
    - On mount: `getActiveGoal()` → set goal (null = no goal, not an error); catch network errors → set goalError
    - **Loading state**: pulse skeleton block `h-24 bg-soft-cloud animate-pulse rounded`
    - **Error state**: "Impossible de charger l'objectif" + "Réessayer" button
    - **No-goal state**: `<div>` with "Aucun objectif actif" text + `<Link to="/goals/new">` styled as `button-primary` pill
    - **Goal panel**: card with goal type badge (pill `bg-soft-cloud text-ink caption-md`), `targetDescription` as `heading-md`, `{horizonWeeks} sem. · {sessionDurationMinutes} min` as `caption-md text-mute`, `<Link to="/goals/new">` "Changer d'objectif" styled as `button-secondary`
  - **Test**: Start dev server `npm run dev:frontend` — `/` shows goal panel or empty state (no backend needed for component structure; test against mock or live backend)

- [x] **T-2.2**: DashboardPage.tsx — sessions list
  - **Do**: Extend `DashboardPage.tsx` (same file as T-2.1):
    - Add `useState` for `sessions: Session[]`, `sessionsLoading: boolean`, `sessionsError: string | null`
    - Fetch `listSessions()` in same `useEffect` (parallel with getActiveGoal using `Promise.allSettled`)
    - **Loading state**: 3 pulse skeleton rows
    - **Error state**: "Impossible de charger les séances" + retry
    - **Empty state** (when goal exists but sessions empty): "Aucune séance planifiée"
    - **Session rows**: `plannedDate` formatted with `new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(s.plannedDate + 'T00:00:00'))` — capitalize first letter; exercise count `{s.exercises.length} exercice(s)`; `<Link to={/sessions/${s.id}>` "Voir" as `button-secondary` small
    - Don't render sessions section at all when no goal
  - **Test**: Dev server `npm run dev:frontend` — visit `/`, verify session list renders or shows empty state

- [x] **T-2.3**: GoalFormPage.tsx — form scaffold + type + description fields
  - **Do**: Create `frontend/src/presentation/planning/GoalFormPage.tsx` — first part:
    - `useState` for all 6 form fields: `type: Goal['type'] | ''`, `targetDescription: string`, `horizonWeeks: number` (default 4), `availabilityDays: number[]` (default []), `sessionDurationMinutes: number` (default 60), `availableEquipment: string[]` (default [])
    - `useState` for `submitting: boolean`, `submitError: string | null`
    - Page wrapper: `min-h-screen bg-soft-cloud`, back link `← Accueil` via `useNavigate(-1)`, heading "Définir un objectif"
    - `type` field: `<label>Type d'objectif</label>` + `FilterChips` (single-select, options from `GOAL_TYPE_OPTIONS` labels, value maps to type value)
    - `targetDescription` field: `<label>Description</label>` + `<input type="text" placeholder="Ex: améliorer le squat" className="w-full px-4 py-2 rounded border border-gray-300 bg-canvas text-ink" />`
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — zero errors; dev server shows form at `/goals/new`

- [x] **T-2.4**: GoalFormPage.tsx — remaining fields + submit
  - **Do**: Extend `GoalFormPage.tsx` (same file as T-2.3):
    - `horizonWeeks` field: `<label>Durée</label>` + `<Stepper min=1 max=12 step=1 value=horizonWeeks onChange=setHorizonWeeks />` + suffix "semaines"
    - `availabilityDays` field: `<label>Jours disponibles</label>` + `<DayPicker selected=availabilityDays onChange=setAvailabilityDays />`
    - `sessionDurationMinutes` field: `<label>Durée de séance</label>` + `<Stepper min=20 max=120 step=5 value=sessionDurationMinutes onChange=setSessionDurationMinutes />` + suffix "min"
    - `availableEquipment` field: `<label>Équipement disponible</label>` + `<MultiFilterChips options=PLANNING_EQUIPMENT_OPTIONS selected=availableEquipment onChange=setAvailableEquipment />`
    - Submit `handleSubmit`: validate `type !== ''` and `availabilityDays.length > 0` (show inline validation message if not); call `createGoal(...)` → `navigate('/')` + `showToast('Objectif enregistré, séances planifiées')`; on error → `showToast('Erreur, réessayez')`; `disabled={submitting}` on submit button
    - Submit button: `<button type="submit" disabled={submitting} className="bg-ink text-canvas px-8 py-3 rounded-full font-medium disabled:opacity-50">` — "Enregistrer" or "…" during submit
    - `<Toast message={message} />`
  - **Test**: Dev server — fill form, submit → redirect to `/` + toast; missing required field → inline error shown

- [x] **T-2.5**: SessionDetailPage.tsx — detail view + exercise list
  - **Do**: Create `frontend/src/presentation/planning/SessionDetailPage.tsx`:
    - `useParams<{ id: string }>()` to get session id
    - `useState` for `session: Session | null`, `loading: boolean`, `error: string | null`
    - On mount: `getSession(id)` → set session; catch → set error
    - **Loading state**: spinner (same pattern as ExerciseDetailPage)
    - **Error state**: "Séance introuvable" + back link
    - **Header**: `plannedDate` formatted same as DashboardPage (Intl long weekday + day + month), bold `heading-xl`
    - **Exercise list**: `session.exercises` ordered by `order`, each row: `<div className="flex justify-between py-3 border-b border-hairline">` — left: exercise name `body-strong`; right: `{sets} × {repsOrDuration}` `caption-md text-mute`
    - Back link `← Accueil` via `navigate(-1)`
  - **Test**: Dev server — navigate to `/sessions/:id` from dashboard, verify header + exercise list render

- [x] **T-2.6**: SessionDetailPage.tsx — replan button
  - **Do**: Extend `SessionDetailPage.tsx` (same file as T-2.5):
    - `useState` for `replanning: boolean`
    - `handleReplan`: set `replanning=true` → call `replanSession(id)` → update `session` state with returned session + `showToast('Séance replanifiée')` → set `replanning=false`; on 409 error (check `err.message.includes('409')`) → `showToast('Cette séance ne peut pas être replanifiée')` → set `replanning=false`; on other error → `showToast('Erreur, réessayez')`
    - "Replanifier" button: render only when `session.status === 'planned'`; `disabled={replanning}`; show spinner icon or "…" when replanning; styled as `button-primary`
    - `<Toast message={message} />`
  - **Test**: Dev server — click "Replanifier" on planned session, verify exercises update + toast; verify button absent on non-planned session
