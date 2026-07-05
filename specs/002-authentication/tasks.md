# Tasks: Authentication

**Plan**: specs/002-authentication/plan.md
**Status**: Ready
**Total**: 31 tasks across 9 phases

> No CLAUDE.md — test commands inferred from package.json. Backend: `npm test --workspace=backend -- --testPathPattern=<name>`. Frontend: `npm test --workspace=frontend`.

---

## Phase 1: Dependencies + env alignment

- [x] **T-1.1**: Add backend auth dependencies
  - **Do**: In `backend/package.json`, add to `dependencies`: `"jose": "^5.0.0"`, `"cookie-parser": "^1.4.7"`. Add to `devDependencies`: `"@types/cookie-parser": "^1.4.8"`. Run `npm install` at root.
  - **Test**: `node -e "require('jose')"` in `backend/` returns no error; `npx tsc --noEmit` in `backend/` still passes.

- [x] **T-1.2**: Add frontend routing dependency
  - **Do**: In `frontend/package.json`, add to `dependencies`: `"react-router-dom": "^6.0.0"`. Run `npm install` at root.
  - **Test**: `npx tsc -b --noEmit` in `frontend/` passes.

- [x] **T-1.3**: Rename `APP_URL` → `FRONTEND_URL`, add auth env vars
  - **Do**:
    - `backend/.env.example`: rename `APP_URL` → `FRONTEND_URL`; add `AUTH_SERVICE_URL=https://auth.sloboda.fr`, `AUTH_CLIENT_ID=trainer`, `AUTH_CLIENT_SECRET=change-me`, `AUTH_WEBHOOK_SECRET=change-me`
    - `backend/src/app.module.ts`: rename `APP_URL` → `FRONTEND_URL` in Joi schema; add `AUTH_SERVICE_URL: Joi.string().required()`, `AUTH_CLIENT_ID: Joi.string().required()`, `AUTH_CLIENT_SECRET: Joi.string().required()`, `AUTH_WEBHOOK_SECRET: Joi.string().required()`
    - `backend/src/main.ts`: rename `process.env.APP_URL` → `process.env.FRONTEND_URL` in CORS config
  - **Test**: `npx tsc --noEmit` in `backend/` passes; grep finds no `APP_URL` in `backend/src/`.

---

## Phase 2: Backend domain layer

- [x] **T-2.1**: Create `AccessTokenPayload` type
  - **Do**: Create `backend/src/domain/auth/access-token-payload.ts` — export `interface AccessTokenPayload { sub: string; email: string; name: string; issuedAt: Date; }`
  - **Test**: `npx tsc --noEmit` in `backend/` passes.

- [x] **T-2.2**: Create `OAuthClient` abstract class
  - **Do**: Create `backend/src/domain/auth/oauth-client.ts` — export `interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; }`, `interface UserProfile { id: string; email: string; name: string; avatarUrl: string; }`, abstract class `OAuthClient` with abstract methods: `authorizeUrl(redirectUri: string): string`, `exchangeCode(code: string, redirectUri: string): Promise<TokenPair>`, `refresh(refreshToken: string): Promise<TokenPair>`, `fetchUserInfo(accessToken: string): Promise<UserProfile>`.
  - **Test**: `npx tsc --noEmit` in `backend/` passes.

- [x] **T-2.3**: Create `AccessTokenVerifier` abstract class
  - **Do**: Create `backend/src/domain/auth/access-token-verifier.ts` — abstract class with `abstract verify(token: string): Promise<AccessTokenPayload | null>`.
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-2.4**: Create `RevokedSessionRepository` abstract class
  - **Do**: Create `backend/src/domain/auth/revoked-session.repository.ts` — abstract class with `abstract markRevoked(userId: string, revokedAt: Date): Promise<void>` and `abstract getRevokedAt(userId: string): Promise<Date | null>`.
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-2.5**: Create `User` domain model and `UserRepository`
  - **Do**: Create `backend/src/domain/auth/user.ts` — `export interface User { id: string; email: string; name: string; avatarUrl: string; createdAt: Date; }`. Create `backend/src/domain/auth/user.repository.ts` — abstract class with `abstract save(user: User): Promise<void>`.
  - **Test**: `npx tsc --noEmit` passes.

---

## Phase 3: Backend application layer

- [x] **T-3.1**: Create `HandleOAuthCallbackUseCase`
  - **Do**: Create `backend/src/application/auth/handle-oauth-callback.use-case.ts` — `@Injectable()` class, inject `OAuthClient` + `UserRepository`. Method `execute(code: string, redirectUri: string): Promise<TokenPair>`: call `exchangeCode`, then `fetchUserInfo`, then `userRepository.save({ id: profile.id, email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl, createdAt: new Date() })`, return `tokenPair`.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=handle-oauth-callback` passes (write spec: mock OAuthClient + UserRepository, verify save called with profile data, verify TokenPair returned).

- [x] **T-3.2**: Create `HandleSessionRevokedUseCase`
  - **Do**: Create `backend/src/application/auth/handle-session-revoked.use-case.ts` — `@Injectable()` class, inject `RevokedSessionRepository`. Method `execute(userId: string): Promise<void>`: call `revokedSessionRepository.markRevoked(userId, new Date())`.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=handle-session-revoked` passes (write spec: mock repo, verify markRevoked called with correct userId).

---

## Phase 4: Backend infrastructure layer

- [x] **T-4.1**: Create `HttpOAuthClient`
  - **Do**: Create `backend/src/infrastructure/auth/http-oauth-client.ts` — port verbatim from home-budget (`HttpOAuthClient` injectable, reads `AUTH_SERVICE_URL`/`AUTH_CLIENT_ID`/`AUTH_CLIENT_SECRET` from ConfigService, implements all 4 abstract methods).
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-4.2**: Create `JwksAccessTokenVerifier`
  - **Do**: Create `backend/src/infrastructure/auth/jwks-access-token-verifier.ts` — port verbatim from home-budget (`JwksAccessTokenVerifier` injectable, reads `AUTH_SERVICE_URL`, creates JWKS set from `/.well-known/jwks.json`, verifies RS256, returns `AccessTokenPayload | null`).
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-4.3**: Create ORM entities (`UserOrmEntity`, `RevokedSessionOrmEntity`)
  - **Do**:
    - `backend/src/infrastructure/persistence/entities/user.orm-entity.ts` — `@Entity({ name: 'users' })` with `@PrimaryColumn('text') id`, `@Column('text') email` (unique index), `@Column('text') name`, `@Column({ type: 'text', name: 'avatar_url' }) avatarUrl`, `@CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt`.
    - `backend/src/infrastructure/persistence/entities/revoked-session.orm-entity.ts` — `@Entity({ name: 'revoked_sessions' })` with `@PrimaryColumn({ type: 'text', name: 'user_id' }) userId`, `@Column({ type: 'timestamptz', name: 'revoked_at' }) revokedAt`.
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-4.4**: Create `TypeOrmUserRepository`
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-user.repository.ts` — `@Injectable()` extends `UserRepository`, inject `@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>`. `save(user: User)`: call `this.repo.save(user)` (upsert by primary key).
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-4.5**: Create `TypeOrmRevokedSessionRepository`
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-revoked-session.repository.ts` — port from home-budget (inject `RevokedSessionOrmEntity` repo, implement `markRevoked` via `save`, `getRevokedAt` via `findOne`). Change `datetime` → `timestamptz` in entity is already done in T-4.3.
  - **Test**: `npx tsc --noEmit` passes.

---

## Phase 5: Backend HTTP layer

- [x] **T-5.1**: Create `auth-cookies.ts` helpers
  - **Do**: Create `backend/src/interfaces/http/auth-cookies.ts` — export `function setAuthCookies(res: Response, tokens: TokenPair, config: ConfigService): void` (sets `access_token` + `refresh_token` httpOnly cookies; `secure: true` in production; `sameSite: 'lax'`; `refresh_token` maxAge 30 days). Export `function clearAuthCookies(res: Response): void` (clears both cookies).
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-5.2**: Create `@Public()` and `@CurrentUser()` decorators
  - **Do**:
    - `backend/src/interfaces/http/decorators/public.decorator.ts` — `export const IS_PUBLIC_KEY = 'isPublic'; export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);`
    - `backend/src/interfaces/http/decorators/current-user.decorator.ts` — port from home-budget (`CurrentUserPayload` interface `{ id: string; email: string; name: string }`, param decorator reading `request.user`).
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-5.3**: Create `JwtAuthGuard`
  - **Do**: Create `backend/src/interfaces/http/guards/jwt-auth.guard.ts` — `@Injectable() implements CanActivate`. Inject `Reflector`, `AccessTokenVerifier`, `RevokedSessionRepository`, `OAuthClient`, `ConfigService`. Logic:
    1. Check `IS_PUBLIC_KEY` via Reflector → return true if public
    2. Read `access_token` cookie from request
    3. If absent → throw `UnauthorizedException`
    4. `verifier.verify(token)` → if null, attempt refresh (step 6)
    5. `revokedRepo.getRevokedAt(payload.sub)` → if `revokedAt > payload.issuedAt` → throw 401
    6. Attach `request.user = { id: payload.sub, email: payload.email, name: payload.name }`
    7. Refresh path: read `refresh_token` cookie → `oauthClient.refresh()` → `setAuthCookies()` → re-verify → attach user
  - **Test**: `npm test --workspace=backend -- --testPathPattern=jwt-auth.guard` passes (write spec: valid token → canActivate true; no cookie → 401; revoked session → 401; expired + valid refresh → new cookies + true).

- [x] **T-5.4**: Create `AuthController`
  - **Do**: Create `backend/src/interfaces/http/controllers/auth.controller.ts` — `@Controller('auth')`, inject `HandleOAuthCallbackUseCase`, `HandleSessionRevokedUseCase`, `OAuthClient`, `ConfigService`. Private helper `callbackUrl(): string` returns `new URL('/api/auth/callback', this.config.getOrThrow('FRONTEND_URL')).toString()`.
    - `@Public() @Get('login')`: `res.redirect(this.oauthClient.authorizeUrl(this.callbackUrl()))`
    - `@Public() @Get('callback')`: `@Query('code') code: string` → `handleOAuthCallback.execute(code, callbackUrl())` → `setAuthCookies(res, tokens, config)` → `res.redirect(FRONTEND_URL)`
    - `@Get('me')`: return `@CurrentUser() user`
    - `@HttpCode(204) @Post('logout')`: `clearAuthCookies(res)`
    - `@Public() @HttpCode(204) @Post('disconnect')`: `@Query('secret') secret: string` → compare with `AUTH_WEBHOOK_SECRET` → if mismatch throw `UnauthorizedException` → `handleSessionRevoked.execute(body.userId)` (body: `{ userId: string }`)
  - **Test**: `npm test --workspace=backend -- --testPathPattern=auth.controller` passes (write spec: login → redirect URL contains client_id; callback → redirect to FRONTEND_URL; me → returns user; disconnect wrong secret → 401).

- [x] **T-5.5**: Add `@Public()` to `HealthController`
  - **Do**: In `backend/src/health/health.controller.ts`, import `Public` from `../interfaces/http/decorators/public.decorator` and add `@Public()` to the `getHealth()` method.
  - **Test**: `npm test --workspace=backend` passes (existing health spec still green).

---

## Phase 6: Backend wiring

- [x] **T-6.1**: Create `AuthModule`
  - **Do**: Create `backend/src/auth/auth.module.ts` — `@Module({})`. Providers:
    - `HttpOAuthClient` as `OAuthClient`
    - `JwksAccessTokenVerifier` as `AccessTokenVerifier`
    - `TypeOrmUserRepository` as `UserRepository`
    - `TypeOrmRevokedSessionRepository` as `RevokedSessionRepository`
    - `HandleOAuthCallbackUseCase`
    - `HandleSessionRevokedUseCase`
    - `AuthController`
    - `{ provide: APP_GUARD, useClass: JwtAuthGuard }`
    - `TypeOrmModule.forFeature([UserOrmEntity, RevokedSessionOrmEntity])`
  - **Test**: `npx tsc --noEmit` passes.

- [x] **T-6.2**: Wire `AuthModule` into `AppModule`
  - **Do**: In `backend/src/app.module.ts`:
    - Import `AuthModule`, add to imports array
    - Add `UserOrmEntity`, `RevokedSessionOrmEntity` to `TypeOrmModule.forRootAsync` entities array
    - Implement `NestModule`, add `configure(consumer: MiddlewareConsumer)` that applies `cookieParser()` middleware for all routes: `consumer.apply(cookieParser()).forRoutes('*')`
  - **Test**: `npm test --workspace=backend` passes; `npx tsc --noEmit` passes.

---

## Phase 7: Frontend auth shell

- [x] **T-7.1**: Create `api-client.ts`
  - **Do**: Create `frontend/src/infrastructure/api-client.ts` — export `interface CurrentUser { id: string; email: string; name: string; }`. Export `apiClient` object with:
    - `fetchCurrentUser(): Promise<CurrentUser | null>` — `GET /api/auth/me`; return null on 401
    - `logout(): Promise<void>` — `POST /api/auth/logout`
  - **Test**: `npx tsc -b --noEmit` in `frontend/` passes.

- [x] **T-7.2**: Create `AuthProvider`
  - **Do**: Create `frontend/src/presentation/auth/AuthProvider.tsx` — port from home-budget: Context with `{ user: CurrentUser | null, loading: boolean, logout: () => Promise<void> }`. On mount: `apiClient.fetchCurrentUser().then(setUser).finally(() => setLoading(false))`. Logout: call `apiClient.logout()`, then `setUser(null)`.
  - **Test**: `npm test --workspace=frontend` passes.

- [x] **T-7.3**: Create `RequireAuth`
  - **Do**: Create `frontend/src/presentation/auth/RequireAuth.tsx` — if `loading` show spinner div; if `!user` return `<Navigate to="/login" replace />`; else return `children`. Accept `{ children: ReactNode }`.
  - **Test**: `npx tsc -b --noEmit` passes.

- [x] **T-7.4**: Create `LoginPage`
  - **Do**: Create `frontend/src/presentation/pages/LoginPage.tsx` — `<main>` centered: `<h1>Trainer</h1>` + `<a href="/api/auth/login" className="...">Se connecter</a>`. Use Tailwind for layout (min-h-screen, flex, items-center, justify-center).
  - **Test**: `npx tsc -b --noEmit` passes.

- [x] **T-7.5**: Wire routing in `App.tsx` and `main.tsx`
  - **Do**:
    - `frontend/src/App.tsx`: replace placeholder with `<Routes>`: `<Route path="/login" element={<LoginPage />} />`, `<Route path="/*" element={<RequireAuth><div className="text-ink"><h1>Dashboard</h1></div></RequireAuth>} />`
    - `frontend/src/main.tsx`: wrap `<App />` in `<BrowserRouter><AuthProvider>...</AuthProvider></BrowserRouter>`
  - **Test**: `npx tsc -b --noEmit` passes.

---

## Phase 8: CI/CD pipelines

- [x] **T-8.1**: Create `ci.yml`
  - **Do**: Create `.github/workflows/ci.yml` — port from home-budget: triggers on push/PR to main. Job `lint-and-test`: checkout → setup-node (`.nvmrc`) → `npm install` → `npm run lint --workspace=backend` → `npx tsc -b --noEmit` (frontend) → `npm test` → `npm run build`. Job `docker-build-check` (PR only): Docker Buildx → build no push with GHA cache.
  - **Test**: File parses as valid YAML (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` succeeds).

- [x] **T-8.2**: Create `build-and-publish.yml`
  - **Do**: Create `.github/workflows/build-and-publish.yml` — port from home-budget: triggers on push to main + release published. Logs into GHCR, extracts metadata (sha, branch, semver, latest tags), builds and pushes Docker image to `ghcr.io/SlobodaFR/home-trainer`.
  - **Test**: Valid YAML; `IMAGE_NAME: ${{ github.repository }}` resolves to correct repo.

- [x] **T-8.3**: Create `deploy-vps.yml`
  - **Do**: Create `.github/workflows/deploy-vps.yml` — port from home-budget, adapting:
    - Deploy dir: `/opt/trainer` (not `/opt/budget`)
    - 1Password refs: `AUTH_CLIENT_ID: op://TECH/thomassloboda_home_secrets/TRAINER_AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET: op://TECH/.../TRAINER_AUTH_SECRET`, `AUTH_WEBHOOK_SECRET: op://TECH/.../TRAINER_AUTH_WEBHOOK_SECRET`, `FRONTEND_URL: op://TECH/.../TRAINER_FRONTEND_URL`, `DATABASE_URL: op://TECH/.../TRAINER_DATABASE_URL`
    - Remove `DATABASE_PATH`, `MINIO_*` from env (trainer uses PostgreSQL; no Litestream)
    - `.env` written to VPS includes `DATABASE_URL` not `DATABASE_PATH`
    - Scripts/Caddyfile sync from `deploy/docker-compose.yml` and `deploy/scripts/update-vps.sh`
  - **Test**: Valid YAML.

---

## Phase 9: Tests

- [x] **T-9.1**: Write `HandleOAuthCallbackUseCase` spec
  - **Do**: Create `backend/src/application/auth/handle-oauth-callback.use-case.spec.ts` — mock `OAuthClient` and `UserRepository`. Test: `execute()` calls `exchangeCode` with code + redirectUri; calls `fetchUserInfo` with access token; calls `userRepository.save` with profile data; returns `TokenPair`.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=handle-oauth-callback` → 1 suite, all green.

- [x] **T-9.2**: Write `HandleSessionRevokedUseCase` spec
  - **Do**: Create `backend/src/application/auth/handle-session-revoked.use-case.spec.ts` — mock `RevokedSessionRepository`. Test: `execute(userId)` calls `markRevoked` with userId and a Date.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=handle-session-revoked` → green.

- [x] **T-9.3**: Write `JwtAuthGuard` spec
  - **Do**: Create `backend/src/interfaces/http/guards/jwt-auth.guard.spec.ts` — mock `AccessTokenVerifier`, `RevokedSessionRepository`, `OAuthClient`. 4 cases: (1) `@Public()` route → canActivate returns true without hitting verifier; (2) valid token + no revocation → user attached; (3) no cookie → `UnauthorizedException`; (4) revoked session (revokedAt > issuedAt) → 401.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=jwt-auth.guard` → 4 cases green.

- [x] **T-9.4**: Write `AuthController` spec
  - **Do**: Create `backend/src/interfaces/http/controllers/auth.controller.spec.ts` — mock use cases + OAuthClient. 4 cases: (1) `GET /auth/login` redirects to URL containing `client_id=trainer`; (2) `GET /auth/me` returns `CurrentUserPayload`; (3) `POST /auth/disconnect` with wrong secret → `UnauthorizedException`; (4) `POST /auth/disconnect` with correct secret → calls `handleSessionRevoked.execute`.
  - **Test**: `npm test --workspace=backend -- --testPathPattern=auth.controller` → green.

- [x] **T-9.5**: Full suite green
  - **Do**: Run `npm test` at root. Verify all suites pass including existing `health.controller.spec.ts`.
  - **Test**: Exit code 0; no failing suites.
