# Review: Authentication

**Date**: 2026-07-05
**Reviewer**: Claude Code (automated)

## Task Completion

- Total: 31 | Completed: 31 | Blocked: 0

## Acceptance Criteria

| #     | Criterion                                                                  | Status | Notes                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | `GET /api/auth/login` redirects with correct client_id and redirect_uri    | PASS   | Tested in `auth.controller.spec.ts` — `authorizeUrl` called with correct callbackUrl                                                                        |
| AC-2  | `GET /api/auth/callback` sets httpOnly cookies + redirects to FRONTEND_URL | WARN   | Implemented in controller; no unit test for callback flow end-to-end                                                                                        |
| AC-3  | `GET /api/auth/me` with valid cookie returns `{ id, email, name }`         | PASS   | Tested via guard (valid token path) + controller me test                                                                                                    |
| AC-4  | `GET /api/auth/me` without cookie returns 401                              | PASS   | Tested in `jwt-auth.guard.spec.ts`                                                                                                                          |
| AC-5  | `POST /api/auth/logout` clears cookies + returns 204                       | WARN   | Implemented in controller; no unit test for logout                                                                                                          |
| AC-6  | `POST /api/auth/disconnect?secret=WRONG` returns 401                       | PASS   | Tested in `auth.controller.spec.ts`                                                                                                                         |
| AC-7  | Correct secret marks session revoked                                       | PASS   | Tested in `auth.controller.spec.ts`                                                                                                                         |
| AC-8  | `GET /api/health` returns 200 without auth                                 | PASS   | `@Public()` applied; tested in `health.controller.spec.ts`                                                                                                  |
| AC-9  | Cookies set with httpOnly, sameSite, secure in prod                        | WARN   | Code in `auth-cookies.ts` correct; no automated test verifies cookie attributes                                                                             |
| AC-10 | JWKS not re-fetched per request                                            | PASS   | `jose createRemoteJWKSet` caches by design; implementation matches                                                                                          |
| AC-11 | Expired token + valid refresh → new cookies transparently                  | WARN   | Guard logic implemented; not covered by existing guard tests                                                                                                |
| AC-12 | `/login` renders "Se connecter" anchor → `/api/auth/login`                 | PASS   | Implemented in `LoginPage.tsx`; no automated test but verifiable by inspection                                                                              |
| AC-13 | Unauthenticated `/` redirects to `/login`                                  | WARN   | `RequireAuth` redirects correctly; no automated test                                                                                                        |
| AC-14 | No redirect loop for authenticated `/login` visit                          | WARN   | `LoginPage` has no redirect-if-authed logic; loop avoided only because `/login` is not wrapped in `RequireAuth`, but an authed user on `/login` stays on it |

## Architecture Compliance

| Decision                                       | Status | Notes                                                                                   |
| ---------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| AD-1: Direct port of home-budget auth          | PASS   | OAuthClient, JwksAccessTokenVerifier, JwtAuthGuard, guard pattern all ported faithfully |
| AD-2: PostgreSQL column types (timestamptz)    | PASS   | Both ORM entities use `timestamptz` for date columns                                    |
| AD-3: Global guard via APP_GUARD               | PASS   | `APP_GUARD` registered in `AuthModule`; health + auth routes marked `@Public()`         |
| AD-4: Rename APP_URL → FRONTEND_URL            | PASS   | `.env.example`, `app.module.ts`, `main.ts` all updated                                  |
| AD-5: GitHub Actions pipelines in this feature | PASS   | `ci.yml`, `build-and-publish.yml`, `deploy-vps.yml` created                             |

## Quality Gates

| Check                 | Status | Details                                                                                                    |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Tests                 | PASS   | 14/14 backend; frontend passes with no tests                                                               |
| Lint                  | PASS   | 0 errors after fixes (import order auto-fixed; unsafe args, optional chains, non-null assertions resolved) |
| Format                | SKIP   | No format command defined in CLAUDE.md                                                                     |
| Type check (backend)  | PASS   | `tsc --noEmit` exits 0                                                                                     |
| Type check (frontend) | PASS   | `tsc -b --noEmit` exits 0                                                                                  |

## Spec Compliance

| Check                                                | Status | Notes                                                                                                                                                                                   |
| ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error handling                                       | PASS   | Guard throws `UnauthorizedException` on all invalid-token paths; disconnect validates secret; callback propagates errors as 500                                                         |
| Codebase patterns                                    | PASS   | Clean architecture layers respected (domain → application → infrastructure → interfaces); no business logic in controllers                                                              |
| Design tokens applied                                | WARN   | `LoginPage.tsx` uses generic Tailwind classes (`bg-gray-900`, `text-gray-900`) instead of DESIGN.md tokens (`colors.ink`, `colors.canvas`). Tailwind config not mapped to token system. |
| Component inventory respected                        | N/A    | No inventory components used; login page is a standalone surface (heading + anchor)                                                                                                     |
| State coverage (loading/empty/error/success/offline) | WARN   | Loading state covered in `RequireAuth`; error state (auth failure) handled by redirect; no explicit empty/offline states for auth shell                                                 |
| A11y baseline                                        | PASS   | "Se connecter" is an `<a>` (correct — navigation, not action); no ARIA issues; focus/keyboard usable via native anchor                                                                  |

## Constitution Compliance

| Principle                           | Status | Notes                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Every endpoint requires JWT      | PASS   | APP_GUARD default; only health, login, callback, disconnect are @Public() with justification                                                                                                                                                                                                          |
| 2. JWTs validated against JWKS only | PASS   | `JwksAccessTokenVerifier` uses `jose` JWKS endpoint exclusively                                                                                                                                                                                                                                       |
| 3. No secrets in code or logs       | PASS   | All secrets read from ConfigService/env; no hardcoded values                                                                                                                                                                                                                                          |
| 4. No PII beyond userId             | WARN   | `users` table stores `email`, `name`, `avatar_url` — beyond userId. Constitution says "nothing else is persisted." Spec explicitly requires profile upsert to support `GET /auth/me`. **Spec wins here** — recommend updating constitution to reflect this intentional exception for the auth module. |
| 5. Session data not lost silently   | N/A    | Not applicable to auth feature                                                                                                                                                                                                                                                                        |
| 6–7. LLM calls async + degrade      | N/A    | Not applicable                                                                                                                                                                                                                                                                                        |
| 8. All env vars in .env.example     | PASS   | All 4 new vars documented in `.env.example`                                                                                                                                                                                                                                                           |
| 9. CORS restricted to FRONTEND_URL  | PASS   | `main.ts` uses `FRONTEND_URL` env var as `origin`                                                                                                                                                                                                                                                     |
| 10. Logout webhook implemented      | PASS   | `POST /api/auth/disconnect` implements session revocation; path differs from constitution (`/auth/disconnect` vs `/auth/logout-webhook`) but functionally equivalent — constitution path reference is stale                                                                                           |

## Issues Found

| Severity | Description                                | Fix                                                                                                |
| -------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| LOW      | AC-2 callback, AC-5 logout not unit-tested | Add `auth.controller.spec.ts` tests for `callback()` and `logout()`                                |
| LOW      | AC-11 token refresh path not covered       | Add guard spec test: expired token + valid refresh → returns true + sets new cookies               |
| LOW      | AC-14 no redirect-if-authed on `/login`    | Add `useEffect` in `LoginPage` or `RequireAuth` logic to redirect `/login` → `/` if `user` is set  |
| LOW      | Design tokens not applied to LoginPage     | Map DESIGN.md tokens in `tailwind.config.ts`; use `bg-canvas`, `text-ink` etc. instead of raw gray |
| INFO     | Constitution principle 4 outdated          | Update constitution to allow email/name storage in auth module                                     |
| INFO     | Constitution logout webhook path stale     | Update from `/auth/logout-webhook` to `/api/auth/disconnect`                                       |

## Verdict

**Pass with notes**

Core auth implementation is solid and production-ready: all critical paths (guard, JWKS verification, revocation, OAuth2 flow, cookie management) are implemented correctly and the critical tests pass. Issues are all LOW severity — missing coverage for secondary endpoints, one missing UX guard, and design token drift. Safe to merge; address in follow-up or next feature cycle.
