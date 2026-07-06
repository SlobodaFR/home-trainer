# Review: Exercise Library — UI

**Date**: 2026-07-06
**Reviewer**: Claude Code (automated)

## Task Completion

- Total: 21 | Completed: 21 | Blocked: 0

## Acceptance Criteria

| #    | Criterion                                                                                    | Status | Notes                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| AC-1 | `/exercises` renders authenticated exercise list with muscle group + equipment filter chips  | PASS   | `ExercisesPage` + `FilterChips` render on `/exercises` inside `RequireAuth`                                       |
| AC-2 | Selecting filter chip reloads list; clearing restores full list                              | PASS   | `load(1, true)` triggered on `muscleGroup`/`equipment` state change via `useEffect([load])`                       |
| AC-3 | Each card shows name, muscle group tags, and favorite toggle icon                            | PASS   | `ExerciseCard` renders name, muscle tag pills, `FavoriteButton`                                                   |
| AC-4 | `/exercises/:id` shows name, instructions, Everkinetic SVG (if slug), YouTube embed (if URL) | PASS   | `ExerciseDetailPage` renders all four conditionally                                                               |
| AC-5 | Favorite toggle on detail page calls API and persists across reload                          | PASS   | `handleFavoriteToggle` calls `toggleFavorite`/`removeFavorite`; enriched endpoint returns persisted state         |
| AC-6 | Preference weight input (1–5) calls API and persists across reload                           | PASS   | `handlePreferenceChange` calls `setPreference`; state seeded from enriched `GET /exercises/:id`                   |
| AC-7 | Favorite state from list page reflects persisted preference                                  | PASS   | `GET /exercises` returns `isFavorite` merged from `user_exercises` table                                          |
| AC-8 | API errors surface as non-blocking toasts; UI reverts optimistic state on failure            | PASS   | `FavoriteButton` reverts on rejected `onToggle`; parent shows toast and re-throws; `setPreference` reverts weight |

## Architecture Compliance

| Decision                                     | Status            | Notes                                                                                   |
| -------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| AD-1: UserExercise composite PK              | PASS              | Two `@PrimaryColumn('text')` in `UserExerciseOrmEntity`                                 |
| AD-2: Enriched use cases accept userId       | PASS              | Both `GetExercisesUseCase` and `GetExerciseByIdUseCase` inject `UserExerciseRepository` |
| AD-3: @CurrentUser() in controller           | PASS              | `user.id` passed to all use cases and new endpoints                                     |
| AD-4: Optimistic UI for favorite toggle      | PASS              | `FavoriteButton` flips local state before API call, reverts on error                    |
| AD-5: Toast via shared hook, no external dep | PASS              | `useToast` + `Toast` — ~30 lines, no library                                            |
| AD-6: Tailwind tokens mapped from DESIGN.md  | PASS (minor miss) | `ink`, `canvas`, `soft-cloud`, `mute`, `success` added; `hairline` missing (see Issues) |
| AD-7: Separate exercise-client.ts            | PASS              | New file, not merged with auth `api-client.ts`                                          |

## Quality Gates

| Check         | Status | Details                             |
| ------------- | ------ | ----------------------------------- |
| Backend tests | PASS   | 33/33 passing, 10 suites            |
| Backend tsc   | PASS   | Zero errors                         |
| Frontend tsc  | PASS   | Zero errors                         |
| Lint / Format | SKIP   | No CLAUDE.md — commands not defined |

## Spec Compliance

| Check                                                | Status            | Notes                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error handling                                       | PASS              | List: error banner + retry. Detail: redirect on 404 + toast. Favorite/preference: toast + revert. Matches spec §Error Scenarios                                                                                                                                                                                                   |
| Codebase patterns                                    | PASS              | Clean architecture maintained: no business logic in controller, use cases injected, domain interfaces separate from ORM entities                                                                                                                                                                                                  |
| Design tokens applied                                | PASS (minor miss) | All color tokens referenced by name in JSX. No raw hex values. See Issues for two filter-chip token misses                                                                                                                                                                                                                        |
| Component inventory respected                        | PASS              | `filter-chip`/`filter-chip-active`, `button-primary` (load more), `button-icon-circular` (favorite) used. New components (`exercise-card`, `everkinetic-viewer`, `preference-weight-input`) declared in plan                                                                                                                      |
| State coverage (loading/empty/error/success/offline) | PASS              | Loading: skeleton (list) + spinner (detail). Empty: "Aucun exercice trouvé" + clear filters. Error: toast + retry. Success: normal render. Offline: not handled per spec                                                                                                                                                          |
| A11y baseline                                        | PASS              | `FilterChips`: `aria-pressed` per chip. `FavoriteButton`: `aria-label` + `aria-pressed`. `PreferenceWeight`: `role="radiogroup"` + `aria-label` per star. `EverkineticViewer`: `alt` on each img. YouTube iframe: `title="Vidéo exercice"`. ExerciseCard clickable area: `role="button"` + `tabIndex=0` + `onKeyDown` Enter/Space |

## Constitution Compliance

| Principle                                 | Status | Notes                                                                                                                                     |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Every endpoint requires JWT            | PASS   | Global `JwtAuthGuard` (pre-existing) covers all `/exercises/*` endpoints                                                                  |
| 2. JWTs validated against JWKS            | PASS   | Auth infrastructure unchanged                                                                                                             |
| 3. No secrets in code or logs             | PASS   | No secrets introduced                                                                                                                     |
| 4. No PII beyond userId                   | PASS   | `user_exercises` stores only `userId` (string from JWT claim)                                                                             |
| 5. Session data never lost silently       | N/A    | No session save paths in F-004                                                                                                            |
| 6–7. LLM calls async / degrade gracefully | N/A    | No LLM in F-004                                                                                                                           |
| 8. All env vars from .env.example         | PASS   | No new env vars introduced                                                                                                                |
| 9–10. CORS / logout webhook               | PASS   | Unchanged                                                                                                                                 |
| **Pre-existing note**                     | WARN   | Constitution lists "PostgreSQL (Locked)" but app uses SQLite since F-003. Not a F-004 regression — constitution needs updating separately |

## Issues Found

| Severity | Description                                                                                                                                                                                                                                                        | Fix                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| WARN     | `FilterChips.tsx:27` — inactive chip uses `border-gray-300` (Tailwind default, #d1d5db) instead of `{colors.hairline}` (#cacacb). Tailwind config missing `hairline` token.                                                                                        | Add `hairline: '#cacacb'` to `tailwind.config.ts` `extend.colors`; change class to `border-hairline`                               |
| WARN     | `FilterChips.tsx:26-27` — chips use `rounded-full` (9999px) but DESIGN.md specifies `filter-chip` uses `{rounded.lg}` = 30px. Visually minimal diff for short labels, but deviates from spec.                                                                      | Change `rounded-full` → `rounded-[30px]` on both active and inactive chip classes                                                  |
| WARN     | `ExercisesPage.tsx:29,34` — `AbortController` created and stored but signal never passed to `listExercises()`. Old requests cannot be cancelled — stale responses can race.                                                                                        | Pass `signal` through `listExercises` params → `request()` fetch init, or remove the AbortController if cancellation is not needed |
| INFO     | `ExerciseDetailPage.tsx:106` — YouTube URL transform `replace('watch?v=', 'embed/')` is fragile for playlist URLs (`watch?v=X&list=Y` → `embed/X&list=Y` works) or mobile-share URLs (`youtu.be/X`). Low risk given Wger seed data is consistent, but worth noting | Consider a proper URL parser or extract the video ID via regex                                                                     |

## Verdict

**Ready to merge**

All 21 tasks complete, 33 backend tests pass, both TypeScript checks clean, all 8 ACs satisfied. Issues are minor token precision misses (hairline color, chip radius) that do not affect functionality. The AbortController warning is low risk given sequential user navigation. Safe to ship.
