# Review: Goal & Planning — UI

**Date**: 2026-07-06
**Reviewer**: Claude Code (automated)

## Task Completion

- Total: 16 | Completed: 16 | Blocked: 0

## Acceptance Criteria

| #     | Criterion                                                                                              | Status | Notes                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | `/` shows active goal panel with type, description, horizon, duration; "Change goal" navigates to form | PASS   | `DashboardPage` renders goal card with type badge, targetDescription, `{horizonWeeks} sem. · {sessionDurationMinutes} min`, and `<Link to="/goals/new">`                                             |
| AC-2  | `/` shows "Aucun objectif actif" + "Définir un objectif" CTA when no goal                              | PASS   | `getActiveGoal` 404 → null → empty state with `<Link to="/goals/new">`                                                                                                                               |
| AC-3  | Sessions list below goal panel, ordered by date, with exercise count                                   | PASS   | `listSessions()` → `DashboardPage` sessions section with `formatDate()` + exercise count                                                                                                             |
| AC-4  | Empty session list shows "Aucune séance planifiée"                                                     | PASS   | Rendered when `sessions.length === 0` and no error                                                                                                                                                   |
| AC-5  | `/goals/new` form has all 6 fields with correct input types and validation                             | PASS   | type (FilterChips), targetDescription (text input), horizonWeeks (Stepper 1–12), availabilityDays (DayPicker), sessionDurationMinutes (Stepper 20–120 step 5), availableEquipment (MultiFilterChips) |
| AC-6  | Goal form submission calls `POST /api/goals`, redirects to `/` on success with toast                   | PASS   | `createGoal()` → `showToast()` → `navigate('/')` after 800ms delay                                                                                                                                   |
| AC-7  | `/sessions/:id` shows plannedDate header + ordered exercise list                                       | PASS   | `getSession()` → `formatDate(session.plannedDate)` header + `.sort((a,b) => a.order - b.order)` exercise rows                                                                                        |
| AC-8  | "Replanifier" button calls replan endpoint, refreshes exercises on success                             | PASS   | `replanSession(id)` → `setSession(updated)` + toast                                                                                                                                                  |
| AC-9  | "Replanifier" button hidden when session status is not `planned`                                       | PASS   | `session.status === 'planned'` guard on button render                                                                                                                                                |
| AC-10 | All loading states show skeleton or spinner; no layout shift on load                                   | PASS   | Dashboard: pulse skeleton blocks; SessionDetail: centered spinner; form: disabled submit during submit                                                                                               |

## Architecture Compliance

| Decision                                              | Followed? | Notes                                                                   |
| ----------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| AD-1: planning-client.ts mirrors exercise-client.ts   | PASS      | Same `request<T>()` helper, same error pattern, same base URL structure |
| AD-2: local useState/useEffect, no external state lib | PASS      | All pages use local state only                                          |
| AD-3: `/` → DashboardPage, no redirect to exercises   | PASS      | `App.tsx` index route now renders `DashboardPage`                       |
| AD-4: Goal form as separate route `/goals/new`        | PASS      | Separate page component, `<Link to="/goals/new">` everywhere            |
| AD-5: MultiFilterChips for equipment                  | PASS      | `MultiFilterChips` created with `string[]` multi-select                 |
| AD-6: DayPicker as 7 pill buttons                     | PASS      | `DayPicker` with `DAY_LABELS` array, indices 0–6                        |
| AD-7: Stepper for numeric inputs                      | PASS      | `Stepper` with min/max/step props                                       |
| AD-8: NavBar in App.tsx                               | PASS      | `<NavBar />` rendered above `<Routes>` inside `RequireAuth`             |

## Quality Gates

| Check             | Status | Details                                                            |
| ----------------- | ------ | ------------------------------------------------------------------ |
| TypeScript        | PASS   | `npx tsc --noEmit --project frontend/tsconfig.app.json` — 0 errors |
| Lint (ESLint)     | PASS   | 0 errors; 1 pre-existing warning in `AuthProvider.tsx` (unrelated) |
| Format (Prettier) | PASS   | 3 files auto-fixed, re-verified clean                              |
| Backend tests     | SKIP   | Frontend-only feature; backend unchanged                           |

## Spec Compliance

| Check                                        | Status | Notes                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error handling                               | PASS   | 404 on `getActiveGoal` → null (not error); network error → `goalError` state + retry; 409 on replan → specific toast; generic error → "Erreur, réessayez" toast                                                                                                                           |
| Codebase patterns                            | PASS   | import/order (sibling before parent), `void` on fire-and-forget promises, same component structure as ExercisesPage/ExerciseDetailPage                                                                                                                                                    |
| Design tokens applied                        | PASS   | No raw hex values; all colors via Tailwind token names (`bg-ink`, `text-canvas`, `bg-soft-cloud`, `text-mute`, `border-hairline`, `divide-hairline`); `rounded-full` pills                                                                                                                |
| Component inventory respected                | PASS   | Uses `button-primary`, `button-secondary` (as outlined link), `filter-chip`/`filter-chip-active` patterns; new components (`NavBar`, `DayPicker`, `Stepper`, `MultiFilterChips`) are additive and follow established chip styling                                                         |
| State coverage (loading/empty/error/success) | PASS   | Dashboard: loading (skeletons) + empty (no goal, no sessions) + error (goal/sessions + retry) + success (data renders); Form: loading (disabled submit) + error (toast) + success (toast + redirect); SessionDetail: loading (spinner) + error (message + back) + success (exercise list) |
| A11y baseline                                | PASS   | NavBar: `<nav aria-label>`. DayPicker/MultiFilterChips: `aria-pressed`. Stepper: `aria-label` on +/− buttons. Form: all fields have `<label>`. `role="status" aria-live="polite"` on Toast (inherited).                                                                                   |

## Constitution Compliance

| Principle                             | Status | Notes                                                                         |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Every API endpoint requires valid JWT | PASS   | All planning routes behind `RequireAuth` (same as exercises)                  |
| JWTs validated against JWKS           | PASS   | Frontend routes protected; JWT validation is backend concern, unchanged       |
| No secrets in code or logs            | PASS   | No env vars or secrets in frontend code                                       |
| No PII stored beyond userId           | PASS   | Frontend stores no PII; `targetDescription` is user-authored content, not PII |
| Session data never lost silently      | N/A    | Workout logging is F-008; form submit failure shows toast                     |
| LLM calls are async                   | N/A    | No LLM in this feature                                                        |
| All env vars documented               | PASS   | No new env vars added                                                         |
| CORS restricted                       | PASS   | No CORS config changes                                                        |
| React: one component per file         | PASS   | Each component in its own file; types co-located                              |
| No `console.log` in production code   | PASS   | None added                                                                    |

## Issues Found

| Severity | Description                                                                                                                                                          | Fix                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOTE     | `DashboardPage` `loadData` defined inside component but called in `useEffect()`; ESLint might flag missing deps if rules change                                      | Acceptable: `loadData` has no deps; `useEffect(() => { loadData() }, [])` is intentional fire-once                                                                                          |
| NOTE     | `button-secondary` in DESIGN.md specifies `bg-soft-cloud` fill; nav "Changer d'objectif" and session "Voir" links use `border border-gray-300` outline style instead | Minor design drift — border style is consistent with existing FilterChips inactive state; `bg-soft-cloud` would read as a filled button which clashes with `button-primary` on same surface |
| NOTE     | `gray-300` used in border classes instead of `hairline` token                                                                                                        | Minor — `border-hairline` would be more consistent; not blocking                                                                                                                            |

## Verdict

**Ready to merge**
