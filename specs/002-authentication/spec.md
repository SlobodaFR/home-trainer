# Spec: Authentication

**Track ID**: 002-authentication
**Roadmap ref**: F-002
**Status**: Complete
**Created**: 2026-07-04
**Branch**: feat/002-authentication
**PRD sections**: Security & Compliance, Configuration
**Depends on**: F-001 (Complete)

## Context

No auth exists yet. All API routes are public. This feature integrates trainer as an OAuth2 client of `home-auth`, following the exact same patterns already proven in `SlobodaFR/home-budget`. The architecture — clean layers, guard, `@Public()`, `@CurrentUser()`, `AuthProvider`, `RequireAuth` — is a direct port of home-budget adapted for PostgreSQL instead of SQLite.

## User Stories

- As a user, I want to click "Se connecter" and be redirected to home-auth magic link so I can log in without a password
- As a user, I want to land on the dashboard after authentication without any extra steps
- As a user, I want my session to persist across page reloads
- As a user, I want to log out and have my session fully revoked
- As a developer, I want all API routes protected by default; `@Public()` opts out

## Functional Requirements

### FR-1: Login initiation

`GET /api/auth/login` redirects to `AUTH_SERVICE_URL/authorize?client_id=AUTH_CLIENT_ID&redirect_uri={callbackUrl}`. No state parameter (mirrors home-budget).

`callbackUrl()` = `new URL('/api/auth/callback', FRONTEND_URL).toString()` — Vite proxies this to the backend in dev.

### FR-2: OAuth2 callback (backend-only)

`GET /api/auth/callback?code=` (public):

1. Calls `HandleOAuthCallbackUseCase.execute(code, callbackUrl())`:
   - exchanges code via `OAuthClient.exchangeCode()`
   - fetches user profile via `OAuthClient.fetchUserInfo()`
   - upserts user in local DB (`UserRepository.save()`)
2. Sets `access_token` + `refresh_token` httpOnly cookies via `setAuthCookies()`
3. Redirects to `FRONTEND_URL`

No frontend `/auth/callback` page needed — Vite proxy routes `FRONTEND_URL/api/auth/callback` directly to the backend.

### FR-3: JWT validation guard (`JwtAuthGuard`)

Global guard (registered in AppModule). Reads `access_token` cookie.

- Validates JWT RS256 via `JwksAccessTokenVerifier` (JWKS from `AUTH_SERVICE_URL/.well-known/jwks.json` — `jose` handles caching)
- Checks session not revoked via `RevokedSessionRepository.getRevokedAt(userId)`
- If expired: attempts refresh via `OAuthClient.refresh()`, sets new cookies
- Attaches `{ id, email, name }` to `request.user`
- `@Public()` decorator bypasses guard

### FR-4: Current user

`GET /api/auth/me` (AuthGuard) returns `@CurrentUser()` payload: `{ id, email, name }`.

### FR-5: Logout

`POST /api/auth/logout` (AuthGuard, 204): clears both cookies via `clearAuthCookies()`.

### FR-6: Session revocation webhook

`POST /api/auth/disconnect?secret=AUTH_WEBHOOK_SECRET` (public, 204):

- Validates `secret` query param against `AUTH_WEBHOOK_SECRET` env var
- Calls `HandleSessionRevokedUseCase.execute(userId)` → marks session revoked in DB
- Subsequent guard checks for this userId will reject valid JWTs issued before revocation

### FR-7: Frontend routing + auth shell

- `react-router-dom` added
- `/login` — `LoginPage`: app title + "Se connecter" anchor → `/api/auth/login`
- All other routes wrapped in `RequireAuth` → calls `GET /api/auth/me`, redirects to `/login` if 401
- `AuthProvider` context provides `{ user, loading, logout }` via `useAuth()` hook
- `main.tsx` wraps `<App>` in `<BrowserRouter>` + `<AuthProvider>`

### FR-8: Env var alignment (update from F-001)

Rename `APP_URL` → `FRONTEND_URL` across `backend/.env.example`, `app.module.ts`, `main.ts` to align with home-budget ecosystem naming.
Add new vars: `AUTH_SERVICE_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_WEBHOOK_SECRET`.

## API Endpoints

| Method | Path                   | Auth            | Purpose                                |
| ------ | ---------------------- | --------------- | -------------------------------------- |
| GET    | `/api/auth/login`      | Public          | Redirect to home-auth authorize        |
| GET    | `/api/auth/callback`   | Public          | Exchange code → set cookies → redirect |
| GET    | `/api/auth/me`         | JwtAuthGuard    | Current user payload                   |
| POST   | `/api/auth/logout`     | JwtAuthGuard    | Clear cookies (204)                    |
| POST   | `/api/auth/disconnect` | Public + secret | Session revocation webhook (204)       |

## Design References

| Surface  | Components used                                                                                                 | New components needed |
| -------- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| `/login` | `button-primary` (Se connecter CTA), `typography.heading-xl` (app title), `colors.canvas` bg, `colors.ink` text | None                  |

## Error Scenarios

- code exchange fails → `HandleOAuthCallbackUseCase` throws → 500 (home-auth unreachable during callback)
- JWT invalid/expired + no valid refresh → guard throws 401 → `RequireAuth` → `/login`
- Refresh fails → 401, clear cookies
- Webhook with wrong secret → 401
- home-auth unreachable at login → standard browser error (redirect fails)

## Acceptance Criteria

- [ ] AC-1: `GET /api/auth/login` redirects to `AUTH_SERVICE_URL/authorize` with correct client_id and redirect_uri
- [ ] AC-2: `GET /api/auth/callback?code=VALID_CODE` sets `access_token` + `refresh_token` httpOnly cookies and redirects to `FRONTEND_URL`
- [ ] AC-3: `GET /api/auth/me` with valid cookie returns `{ id, email, name }`
- [ ] AC-4: `GET /api/auth/me` without cookie returns 401
- [ ] AC-5: `POST /api/auth/logout` clears cookies and returns 204
- [ ] AC-6: `POST /api/auth/disconnect?secret=WRONG` returns 401
- [ ] AC-7: `POST /api/auth/disconnect?secret=CORRECT` marks session revoked; subsequent `GET /api/auth/me` with same user's token returns 401
- [ ] AC-8: `GET /api/health` still returns 200 without auth (still `@Public()`)
- [ ] AC-9: Both cookies set with `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production
- [ ] AC-10: JWKS not re-fetched on every request (jose `createRemoteJWKSet` caching)
- [ ] AC-11: Expired access token + valid refresh → new cookies set transparently
- [ ] AC-12: `/login` renders "Se connecter" anchor pointing to `/api/auth/login`
- [ ] AC-13: Unauthenticated visit to `/` redirects to `/login`
- [ ] AC-14: Authenticated visit to `/login` after redirect stays on `/` (or no redirect loop)

## Out of Scope

- User profile editing (home-auth handles it)
- PKCE (home-auth `/authorize` does not expose `code_challenge` param)
- Social login variants
- State parameter in OAuth2 flow (home-budget does not use it; home-auth doesn't require it)

## Open Questions

- None
