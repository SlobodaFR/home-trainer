# Plan: Authentication

**Spec**: specs/002-authentication/spec.md

## Architecture Decisions

### AD-1: Direct port of home-budget auth with minimal diff

- **Choice**: Copy `OAuthClient`, `AccessTokenVerifier`, `RevokedSessionRepository`, `JwksAccessTokenVerifier`, `HttpOAuthClient`, `JwtAuthGuard`, `@Public()`, `@CurrentUser()`, `AuthProvider`, `RequireAuth` from home-budget; adapt only where trainer differs
- **Rationale**: Pattern is proven and maintained in the same ecosystem; diverging creates drift and maintenance burden
- **Alternatives considered**: Write from scratch — costs time with zero upside

### AD-2: PostgreSQL column types instead of SQLite

- **Choice**: `timestamptz` for `revokedAt` and `createdAt` in ORM entities (not `datetime`)
- **Rationale**: trainer uses PostgreSQL; TypeORM `datetime` maps to TIMESTAMP WITHOUT TIME ZONE in Postgres — `timestamptz` is safer for session tokens
- **Alternatives considered**: `datetime` — works but doesn't store tz info, risky near DST

### AD-3: Global guard via APP_GUARD

- **Choice**: `JwtAuthGuard` registered as `APP_GUARD` provider in `AuthModule`; routes opt-out with `@Public()`
- **Rationale**: Matches home-budget; opt-out is safer than opt-in (new routes are protected by default)
- **Alternatives considered**: Register in `AppModule` — functionally equivalent but less cohesive

### AD-4: Rename `APP_URL` → `FRONTEND_URL`

- **Choice**: Rename the var across `.env.example`, `app.module.ts`, `main.ts` as part of this feature
- **Rationale**: First feature where the name matters (callbackUrl uses it); aligns with home-budget ecosystem naming now before more features depend on it
- **Alternatives considered**: Keep both — adds confusion, not worth it

### AD-5: Add GitHub Actions pipelines in this feature

- **Choice**: ci.yml + build-and-publish.yml + deploy-vps.yml, mirroring home-budget; deploy uses 1Password for secrets
- **Rationale**: First shippable feature; F-001 explicitly excluded CI/CD; now is the right moment
- **Alternatives considered**: Separate feature — unnecessary since the pipeline is trivial to copy

## Affected Files

### New Files

| File                                                                                        | Purpose                                                                 |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `backend/src/domain/auth/access-token-payload.ts`                                           | `{ sub, email, name, issuedAt: Date }`                                  |
| `backend/src/domain/auth/oauth-client.ts`                                                   | Abstract: `authorizeUrl`, `exchangeCode`, `refresh`, `fetchUserInfo`    |
| `backend/src/domain/auth/access-token-verifier.ts`                                          | Abstract: `verify(token): AccessTokenPayload \| null`                   |
| `backend/src/domain/auth/revoked-session.repository.ts`                                     | Abstract: `markRevoked`, `getRevokedAt`                                 |
| `backend/src/domain/auth/user.ts`                                                           | Domain model `{ id, email, name, avatarUrl, createdAt }`                |
| `backend/src/domain/auth/user.repository.ts`                                                | Abstract: `save(user): Promise<void>`                                   |
| `backend/src/application/auth/handle-oauth-callback.use-case.ts`                            | Exchange code → fetch profile → upsert user → return tokens             |
| `backend/src/application/auth/handle-session-revoked.use-case.ts`                           | Mark session revoked in repo                                            |
| `backend/src/infrastructure/auth/http-oauth-client.ts`                                      | HTTP impl: calls home-auth `/token`, `/userinfo`, `/authorize`          |
| `backend/src/infrastructure/auth/jwks-access-token-verifier.ts`                             | `jose` JWKS verifier against `AUTH_SERVICE_URL/.well-known/jwks.json`   |
| `backend/src/infrastructure/persistence/entities/user.orm-entity.ts`                        | TypeORM entity `users` (timestamptz)                                    |
| `backend/src/infrastructure/persistence/entities/revoked-session.orm-entity.ts`             | TypeORM entity `revoked_sessions` (timestamptz)                         |
| `backend/src/infrastructure/persistence/repositories/typeorm-user.repository.ts`            | TypeORM `UserRepository` impl (upsert)                                  |
| `backend/src/infrastructure/persistence/repositories/typeorm-revoked-session.repository.ts` | TypeORM `RevokedSessionRepository` impl                                 |
| `backend/src/interfaces/http/controllers/auth.controller.ts`                                | login / callback / me / logout / disconnect                             |
| `backend/src/interfaces/http/guards/jwt-auth.guard.ts`                                      | Reads cookie, verifies JWT, checks revocation, handles refresh          |
| `backend/src/interfaces/http/decorators/public.decorator.ts`                                | `@Public()` SetMetadata                                                 |
| `backend/src/interfaces/http/decorators/current-user.decorator.ts`                          | `@CurrentUser()` param decorator                                        |
| `backend/src/interfaces/http/auth-cookies.ts`                                               | `setAuthCookies` + `clearAuthCookies` helpers                           |
| `backend/src/auth/auth.module.ts`                                                           | Wires all auth providers; registers `APP_GUARD`                         |
| `frontend/src/infrastructure/api-client.ts`                                                 | `fetchCurrentUser()` + `logout()` + shared fetch wrapper                |
| `frontend/src/presentation/auth/AuthProvider.tsx`                                           | Context: `user`, `loading`, `logout`; calls `GET /api/auth/me` on mount |
| `frontend/src/presentation/auth/RequireAuth.tsx`                                            | `Navigate` to `/login` if no user                                       |
| `frontend/src/presentation/pages/LoginPage.tsx`                                             | "Trainer" heading + "Se connecter" anchor → `/api/auth/login`           |
| `.github/workflows/ci.yml`                                                                  | Lint + type-check + test + build + docker-check                         |
| `.github/workflows/build-and-publish.yml`                                                   | Build + push to GHCR on merge to main                                   |
| `.github/workflows/deploy-vps.yml`                                                          | Pull 1Password secrets → write .env → pull image → restart              |

### Modified Files

| File                                      | Change                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/package.json`                    | Add `jose`, `cookie-parser`, `@types/cookie-parser`                                                                                      |
| `backend/.env.example`                    | Rename `APP_URL` → `FRONTEND_URL`; add `AUTH_SERVICE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_WEBHOOK_SECRET`                 |
| `backend/src/app.module.ts`               | Rename `APP_URL` → `FRONTEND_URL` in Joi schema; add `AuthModule`; add `cookie-parser` middleware; add new ORM entities to TypeOrmModule |
| `backend/src/main.ts`                     | Rename `APP_URL` → `FRONTEND_URL` in CORS config                                                                                         |
| `backend/src/health/health.controller.ts` | Add `@Public()` to `GET /health`                                                                                                         |
| `frontend/package.json`                   | Add `react-router-dom`, `@types/react-router-dom`                                                                                        |
| `frontend/src/main.tsx`                   | Wrap with `<BrowserRouter>` + `<AuthProvider>`                                                                                           |
| `frontend/src/App.tsx`                    | Replace placeholder with Routes: `/login` + `/(RequireAuth)`                                                                             |

## Implementation Phases

### Phase 1: Dependencies + env alignment

- Add `jose`, `cookie-parser`, `@types/cookie-parser` to `backend/package.json`
- Add `react-router-dom` to `frontend/package.json`
- Rename `APP_URL` → `FRONTEND_URL` in `backend/.env.example`, `app.module.ts`, `main.ts`
- Add `AUTH_SERVICE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_WEBHOOK_SECRET` to Joi schema + `.env.example`

### Phase 2: Backend domain layer

- `access-token-payload.ts`, `oauth-client.ts` (abstract + DTOs), `access-token-verifier.ts`, `revoked-session.repository.ts`, `user.ts`, `user.repository.ts`

### Phase 3: Backend application layer

- `handle-oauth-callback.use-case.ts` — exchange code → fetchUserInfo → upsert user → return `TokenPair`
- `handle-session-revoked.use-case.ts` — `markRevoked(userId, new Date())`

### Phase 4: Backend infrastructure layer

- `http-oauth-client.ts` (port from home-budget, no changes needed)
- `jwks-access-token-verifier.ts` (port from home-budget, no changes needed)
- `user.orm-entity.ts` — `timestamptz` for `created_at`
- `revoked-session.orm-entity.ts` — `timestamptz` for `revoked_at`
- `typeorm-user.repository.ts` — upsert via `save()`
- `typeorm-revoked-session.repository.ts` (port from home-budget)

### Phase 5: Backend HTTP layer

- `auth-cookies.ts` — `setAuthCookies(res, tokens, config)` + `clearAuthCookies(res)`
- `public.decorator.ts`, `current-user.decorator.ts`
- `jwt-auth.guard.ts` — reads `access_token` cookie; verifies; checks revocation; auto-refresh
- `auth.controller.ts` — 5 endpoints; `callbackUrl()` helper using `FRONTEND_URL`
- `health.controller.ts` — add `@Public()`

### Phase 6: Backend wiring

- `auth.module.ts` — declare all providers; export guard; register `APP_GUARD`
- `app.module.ts` — import `AuthModule`; add `cookie-parser` middleware; add 2 ORM entities

### Phase 7: Frontend auth shell

- `api-client.ts` — `fetchCurrentUser()` (`GET /api/auth/me`), `logout()` (`POST /api/auth/logout`)
- `AuthProvider.tsx` — fetch on mount, expose `{ user, loading, logout }`
- `RequireAuth.tsx` — loading state + redirect
- `LoginPage.tsx` — app title + anchor
- `App.tsx` — Routes; `/login` → `LoginPage`, `/*` → `RequireAuth` wrapper
- `main.tsx` — `<BrowserRouter>` + `<AuthProvider>`

### Phase 8: CI/CD pipelines

- `ci.yml` — port from home-budget (npm workspaces compatible)
- `build-and-publish.yml` — port from home-budget (GHCR push)
- `deploy-vps.yml` — port from home-budget; replace `BUDGET_*` 1Password refs with `TRAINER_*`; replace `/opt/budget` with `/opt/trainer`; add `DATABASE_URL` (PostgreSQL) instead of `DATABASE_PATH`

### Phase 9: Tests

- `handle-oauth-callback.use-case.spec.ts` — mock OAuthClient + UserRepository
- `handle-session-revoked.use-case.spec.ts` — mock RevokedSessionRepository
- `jwt-auth.guard.spec.ts` — mock verifier + repo; test: valid token, no cookie, expired+refresh, revoked
- `auth.controller.spec.ts` — test login redirect URL, me returns user, logout clears cookies, disconnect rejects wrong secret

## Design Mobilization

- **Tokens used**: `colors.canvas` (login page bg), `colors.ink` (text + CTA), `typography.heading-xl` (app title), `spacing.xl`/`md` (CTA padding)
- **Components used**: none from inventory — login page is a standalone surface (1 anchor, 1 heading)
- **Surfaces touched**: `/login` (new)
- **States covered**: loading (RequireAuth spinner), redirect (unauthenticated), success (authenticated)
- **A11y notes**: "Se connecter" is an `<a>` not `<button>` — correct since it navigates; no extra ARIA needed

## Test Strategy

- **Mocking approach**: Jest `TestingModule` on backend; Vitest + `@testing-library/react` on frontend. Mock `OAuthClient`, `UserRepository`, `AccessTokenVerifier`, `RevokedSessionRepository` via NestJS DI overrides.
- **Happy paths**:
  - Callback: code exchanged, user upserted, cookies set, redirect issued
  - Me: valid cookie → 200 `{ id, email, name }`
  - Guard: valid token → `request.user` populated
  - Frontend: AuthProvider fetches me → user non-null → RequireAuth renders children
- **Error scenarios**:
  - No cookie → 401
  - Revoked session → 401
  - Wrong webhook secret → 401
  - Expired token + valid refresh → new cookies set transparently
  - Frontend: me returns 401 → RequireAuth redirects to /login
- **Edge cases**:
  - Callback called with no `code` param — NestJS ValidationPipe handles (400)
  - JWKS unreachable — `verify()` returns null → 401 (no crash)

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**:
  - `cookie-parser` must be applied before `JwtAuthGuard` executes — register as middleware in `AppModule.configure()`, not as a global pipe
  - Cookie `secure: true` only in production — Vite dev proxy must forward cookies (it does, same origin after proxy)
  - `synchronize: true` in dev will auto-create `users` and `revoked_sessions` tables on first run
- **New dependencies**: `jose` (JWKS — actively maintained, used in home-budget), `cookie-parser` (Express middleware — actively maintained), `react-router-dom` v6 (standard)
