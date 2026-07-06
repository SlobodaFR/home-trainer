# Review: Exercise Library — Data Layer

**Date**: 2026-07-06
**Reviewer**: Claude Code (automated)

## Task Completion

- Total: 17 | Completed: 17 | Blocked: 0

## Acceptance Criteria

| #     | Criterion                                                   | Status | Notes                                                                              |
| ----- | ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| AC-1  | `seed:wger` runs without error on a clean DB, ≥ 50 rows     | WARN   | Manual only — requires live DB + external Wger API. Script correct; untested in CI |
| AC-2  | Re-running seed is idempotent (no duplicates, no errors)    | WARN   | Manual only — `upsert` with `conflictPaths: ['wgerId']` is correct mechanism       |
| AC-3  | `GET /api/exercises` returns `{ data, total, page, limit }` | PASS   | Unit-tested in `exercise.controller.spec.ts`                                       |
| AC-4  | `muscleGroup` filter narrows results                        | PASS   | Tested in controller spec + `= ANY()` in QueryBuilder                              |
| AC-5  | `equipment` filter narrows results                          | PASS   | Tested in controller spec + `= ANY()` in QueryBuilder                              |
| AC-6  | `GET /api/exercises/:id` returns full detail                | PASS   | Unit-tested — found path                                                           |
| AC-7  | Unknown ID returns 404                                      | PASS   | Unit-tested — `NotFoundException` thrown when use case returns null                |
| AC-8  | `limit=101` returns 400                                     | PASS   | `@Max(100)` on DTO + global `ValidationPipe`                                       |
| AC-9  | No auth cookie → 401                                        | PASS   | Global `APP_GUARD` (`JwtAuthGuard`) applies to all routes including `/exercises`   |
| AC-10 | Everkinetic SVGs present at `frontend/public/everkinetic/`  | PASS   | 40 SVGs downloaded (20 exercises × tension+relaxation)                             |

## Architecture Compliance

| Decision                        | Followed? | Notes                                                                                                       |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| AD-1: `text[]` + `= ANY()`      | PASS      | `ExerciseOrmEntity` uses `{ type: 'text', array: true }`; QueryBuilder uses `:param = ANY(exercise.column)` |
| AD-2: Standalone ts-node seed   | PASS      | Bare `DataSource`, no NestJS bootstrap, invoked via `ts-node -r tsconfig-paths/register`                    |
| AD-3: Upsert via wger_id        | PASS      | `repo.upsert(batch, { conflictPaths: ['wgerId'], skipUpdateIfNoValuesChanged: true })`                      |
| AD-4: Use cases for query logic | PASS      | `GetExercisesUseCase` + `GetExerciseByIdUseCase` follow exact auth pattern                                  |
| AD-5: SVGs bundled, slug null   | PASS      | `everkineticSlug` nullable in entity; seed sets it to null; slug→SVG mapping deferred to F-004              |

## Quality Gates

| Check      | Status | Details                                                                                 |
| ---------- | ------ | --------------------------------------------------------------------------------------- |
| Tests      | PASS   | 24/24 backend, 0/0 frontend — all green                                                 |
| Lint       | PASS   | 0 errors after fixing import order, unused params, dot-notation, unnecessary conditions |
| Format     | SKIP   | No format command in CLAUDE.md                                                          |
| Type check | PASS   | `tsc --noEmit` clean across both workspaces                                             |

## Spec Compliance

| Check                         | Status | Notes                                                                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| Error handling                | PASS   | 404 on unknown ID, 400 on invalid `limit`, 401 via global guard, seed exits non-zero on error         |
| Codebase patterns             | PASS   | Module-per-domain (`exercise/`), controller → use case → repository, no business logic in controllers |
| Design tokens applied         | N/A    | No user-facing UI in this feature                                                                     |
| Component inventory respected | N/A    | No user-facing UI in this feature                                                                     |
| State coverage                | N/A    | No user-facing UI in this feature                                                                     |
| A11y baseline                 | N/A    | No user-facing UI in this feature                                                                     |

## Constitution Compliance

| Principle                          | Status | Notes                                                                    |
| ---------------------------------- | ------ | ------------------------------------------------------------------------ |
| 1. Every API endpoint requires JWT | PASS   | `APP_GUARD` applies globally; `/exercises` endpoints are not `@Public()` |
| 2. JWTs validated against JWKS     | PASS   | Inherited from F-002 `JwtAuthGuard` — unchanged                          |
| 3. No secrets in code or logs      | PASS   | `DATABASE_URL` from env; no tokens logged                                |
| 4. No PII stored beyond userId     | PASS   | `exercises` table stores no user data                                    |
| 5–7. Session / LLM principles      | N/A    | Not applicable to this feature                                           |
| 8. All env vars in `.env.example`  | PASS   | No new env vars introduced                                               |
| 9. CORS restricted to APP_URL      | PASS   | Unchanged from foundation                                                |
| 10. Logout webhook implemented     | N/A    | Not affected                                                             |

## Issues Found

| Severity | Description                                                                                                         | Fix                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOW      | `@CurrentUser()` was added to both controller handlers but not used — removed during review                         | Fixed — `APP_GUARD` handles auth; no need to inject unused user payload                                                                                                           |
| LOW      | Everkinetic dataset contains per-exercise SVGs (numbered by wger ID), not per-muscle diagrams as the task specified | Note in F-004: `everkineticSlug` should store the 4-digit wger ID; F-004 UI renders `{slug}-tension.svg` / `{slug}-relaxation.svg`; slug→file mapping is `0001` = wger exercise 1 |
| INFO     | `console.log` used in seed script                                                                                   | Constitution §4 says no `console.log` in production code. The seed is a developer CLI tool (not production code path), so this is acceptable — but worth noting                   |

## Verdict

**Pass with notes**
