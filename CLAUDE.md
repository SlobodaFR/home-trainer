# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Development
npm run dev:backend          # tsc build then node --watch dist (port 3000); rebuild to pick up source changes
npm run dev:frontend         # Vite dev server (port 5173)

# Tests
npm run test                 # backend + frontend Vitest (runs on pre-push hook)
npm run test --workspace=backend -- use-case-name  # specs whose path matches

# Lint + format
npm run lint                 # Oxlint (type-aware), whole repo
npm run format               # Oxfmt, whole repo
npm run format:check         # what CI checks
npm run typecheck            # backend (specs included) + frontend

# Seed exercises from Wger (one-time; runs the compiled seed, so build the backend first)
npm run build:backend && npm run seed:wger --workspace=backend
```

## Architecture

### Monorepo layout

```
backend/   NestJS + TypeORM + better-sqlite3
frontend/  React 19 + Vite + Tailwind + React Router v6
specs/     Feature specs, plans, tasks, reviews per feature track
```

### Backend — clean architecture layers

Every domain feature follows the same 5-layer stack:

```
domain/{feature}/
  *.ts              — pure interfaces (no NestJS/TypeORM imports)
  *.repository.ts   — abstract classes only (no impl)

application/{feature}/
  *.use-case.ts     — @Injectable, injects abstract repos, throws NestJS exceptions
  *.use-case.spec.ts

infrastructure/persistence/
  entities/         — TypeORM @Entity classes
  repositories/     — TypeOrmXxxRepository extends abstract, @InjectRepository(OrmEntity)

interfaces/http/
  controllers/      — delegates to use cases only, no business logic
  dto/              — class-validator decorated classes
  decorators/       — @CurrentUser(), @Public()
  guards/           — JwtAuthGuard (registered as APP_GUARD in AuthModule)

{feature}/
  {feature}.module.ts  — TypeOrmModule.forFeature + use cases + repo bindings
```

**Module pattern**: each feature module declares its own `TypeOrmModule.forFeature([...])`, binds abstract repos (`{ provide: SessionRepository, useClass: TypeOrmSessionRepository }`), and lists all use cases as providers. `AppModule` imports all feature modules and registers every ORM entity in `TypeOrmModule.forRootAsync`.

**Auth**: `JwtAuthGuard` is a global `APP_GUARD` (registered in `AuthModule`). Every route is protected by default. Use `@Public()` to opt out. `@CurrentUser()` param decorator extracts `{ id, email, name }` from `request.user`.

**Access token claims (flag `auth-verify-token-claims`)**: `JwksAccessTokenVerifier` verifies the RS256 signature against the home-auth JWKS. When the flag is on in home-features (code default `false`: signature, expiry and mandatory claims only, as before), it also requires `aud` = `AUTH_CLIENT_ID`, `iss` = origin of `AUTH_SERVICE_URL` and `alg` = `RS256` (home-auth contract PC3). Reading the flag never blocks nor fails a request (30 s memo, last known value, code default); `FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS=true|false` forces it. Contract PC4 (`/me` rejects a token whose `aud` is not a single existing client) is enforced by home-auth: this service only forwards its own access token.

**Logout webhook (`POST /api/auth/disconnect`)**: sent by home-auth when a user logs out everywhere; marks the user's sessions revoked. `WebhookAuthenticator` (contract PC7) accepts it by _double acceptance_: a valid signature OR the legacy `?secret=` (compared in constant time with `AUTH_WEBHOOK_SECRET`). Signature: headers `X-Auth-Webhook-Id` (uuid), `X-Auth-Webhook-Timestamp` (unix s, `|now - ts| <= 120 s`) and `X-Auth-Webhook-Signature: v1=<hex>[,v1=<hex>]` (two entries during a secret rotation), `hex = HMAC-SHA256(secret, id + "." + ts + "." + rawBody)` where the key is the 64-hex `AUTH_WEBHOOK_SIGNING_SECRET` taken as a UTF-8 string and `rawBody` the exact bytes received (`rawBody: true` in `main.ts`). Each entry is hex-decoded to 32 bytes and compared with `timingSafeEqual`; an id seen in the last 10 minutes is refused (in-memory set: per process, lost on restart; an id is kept only after a valid signature). "Signature headers present" means any of the three headers non-empty; then the seen-id check runs first (before format, signing-secret and raw-body checks) and a replay is refused (401) EVEN with a valid `?secret=` and whatever the flag. Other signature failures (format, window, hmac) or an uncheckable signature (no signing secret, raw body unavailable) fall back to the legacy `?secret=` while the flag is off. `AUTH_WEBHOOK_SIGNING_SECRET` is optional (absent: only the legacy path). The flag `auth-webhook-require-signature` (code default `false`) makes the signature mandatory and ignores `?secret=`; if it is on while no signing secret is configured, every webhook is refused. Observability: a webhook accepted through the legacy `?secret=` always logs a WARN naming why the signature did not do it (`no-signature-headers`, `missing-signing-secret`, `format`, `window`, `raw-body-unavailable`, `hmac`), and one accepted by signature logs an INFO; a refused replay logs its own throttled WARN; all are throttled to one line per reason per 5 minutes (injectable clock) and never contain a secret, signature or id. Before enabling the strict flag, confirm there is no legacy-accepted WARN over a full day of deliveries. Fixed test vectors (copied from home-auth, `webhook-signature.spec.ts`) must not change.

**Session auth check pattern**: `if (session?.userId !== userId) throw new NotFoundException(...)` — optional chain, not `!session ||`.

**Error codes**: `NotFoundException` → 404, `ConflictException` → 409, class-validator `ValidationPipe` → 400.

**Database**: SQLite via `better-sqlite3`, `synchronize: true` (schema auto-migrated). DB file path from `DATABASE_PATH` env var.

### Feature flags (home-features)

The backend reads boolean flags from [home-features](https://features.sloboda.fr) over OFREP (`@openfeature/server-sdk` + `@openfeature/ofrep-provider`) behind the port `FeatureFlags.isEnabled(key, codeDefault)` (`backend/src/domain/shared/feature-flags.ts`), provided globally by `FeatureFlagsModule`. The adapter (`backend/src/infrastructure/feature-flags/`) contains nothing specific to this service: it is the reference copy from home-auth (PR #86), copied verbatim by every home-* service.

- **Configuration**: `FEATURES_OFREP_URL` (`https://features.sloboda.fr/api`, https required in production) and `FEATURES_API_KEY` (server key bound to the app and environment, `hf_` + 64 hex). Absent: every flag equals its code default (one warning). Invalid: same, with an error logged. Startup never waits for home-features (and the Joi schema does not reject these values).
- **Evaluation**: 500 ms timeout per request, result memoized 30 s per key. Value set for the environment: that value. No value (`DISABLED`) or unknown flag (`FLAG_NOT_FOUND`): code default. Any other error (network, timeout, 401, 429, 5xx): last known value, else code default, memoized 30 s too, WARN at most every 5 min per flag and error code. The last known value lives in the process only (lost on restart).
- **Emergency pin**: `FEATURES_PIN_<KEY_IN_UPPER_SNAKE>=true|false` (e.g. `FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS=false`) wins over everything, even without home-features; any other value is ignored (error logged); needs a container restart. Any character outside `[A-Za-z0-9]` becomes `_`.
- `OFREP_ENDPOINT`, `OFREP_HEADERS` and `OFREP_TIMEOUT_MS`, which the provider would otherwise read, are ignored and removed from the environment at startup (warn).
- `main.ts` calls `enableShutdownHooks()` so the OpenFeature client is closed on SIGTERM.

### Frontend — layer structure

```
infrastructure/
  api-client.ts      — fetchCurrentUser, logout
  exercise-client.ts — typed fetch wrappers for /api/exercises
  planning-client.ts — typed fetch wrappers for /api/goals, /api/sessions

presentation/
  auth/              — RequireAuth wrapper, useAuth hook
  exercises/         — ExercisesPage, ExerciseDetailPage
  planning/          — DashboardPage, GoalFormPage, SessionDetailPage
  shared/            — NavBar, reusable components (DayPicker, Stepper, etc.)
```

**API client pattern**: each domain client defines a `request<T>()` helper (`fetch` with `credentials: 'include'`; non-ok → `throw new Error(\`${status}: ...\`)`). 404 on `getActiveGoal()`returns`null`; other errors rethrow.

**Routing**: `RequireAuth` wraps all authenticated routes. `NavBar` is rendered inside `RequireAuth`, outside the inner `Routes`. Use `<NavLink>` with `end` for exact-path active styling.

**Date display**: always `new Date(isoDate + 'T00:00:00')` to avoid UTC offset shift when formatting ISO date strings.

**Form events**: avoid `React.FormEvent` type annotation (deprecated in newer `@types/react`). Use `onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}` inline.

### Design system

Design tokens are in `DESIGN.md` and `frontend/tailwind.config.ts`. Reference tokens by name:

| Token        | Value     | Use              |
| ------------ | --------- | ---------------- |
| `ink`        | `#111111` | Primary text     |
| `canvas`     | `#ffffff` | Page background  |
| `soft-cloud` | `#f5f5f5` | Card backgrounds |
| `mute`       | `#707072` | Secondary text   |
| `hairline`   | `#cacacb` | Borders          |

CTAs use `rounded-full` (pill shape). Never use raw hex values in component code.

### Lint

Oxlint (`.oxlintrc.json`) and Oxfmt (`.oxfmtrc.json`) at the root; no ESLint or Prettier. Spec files relax a few type-aware rules for mocks (see the overrides).

### Pre-commit / pre-push hooks

- **pre-commit**: lint-staged runs Oxfmt on staged files.
- **pre-push**: full `npm test` (backend + frontend Vitest). Must pass before push.
- Commits require conventional format: `feat(NNN): description`, `fix: ...`, `chore: ...`. No `Co-Authored-By`.

### Ops telemetry (convention harnais `ops-telemetry`)

The backend sends two anonymous operational events to PostHog through the port `Telemetry.capture({ name, properties })` (`backend/src/domain/shared/telemetry.ts`), provided globally by `TelemetryModule` (adapter `PostHogTelemetry`, `posthog-node`):

- `runtime_health` every 60 s (`RuntimeHealthMonitor`: `lag_p50_ms`, `lag_p99_ms`, `lag_max_ms`, `elu`, `rss_mb`, `heap_used_mb`; the log line and `/healthz` keep the same sample) and `http_request` per request handled by a Nest route (`TelemetryInterceptor`: `method`, `route` template, `status`, `duration_ms`). Every event also carries `service: 'home-trainer'`.
- Anonymous by construction: random UUID `distinctId`, `$process_person_profile: false`, `$ip: null`, no user id, never the raw URL, query, params, headers or body. `/healthz` and `/api/health` (probed) are not reported; the SPA and static assets are served outside Nest routes and never intercepted.
- **Configuration**: `POSTHOG_API_KEY` (and optionally `POSTHOG_HOST`, default `https://eu.i.posthog.com`). Absent or blank: NOOP adapter (no client, no network, startup never depends on PostHog). The queue is flushed on shutdown, bounded to 5 s (`enableShutdownHooks`).
