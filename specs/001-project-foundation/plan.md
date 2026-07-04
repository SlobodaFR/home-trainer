# Plan: Project Foundation

**Spec**: specs/001-project-foundation/spec.md

## Architecture Decisions

### AD-1: Mirror home-auth monorepo structure
- **Choice**: npm workspaces, identical scripts, Husky/commitlint/lint-staged, ESLint+Prettier
- **Rationale**: Zero overhead switching between projects; conventions already proven

### AD-2: PostgreSQL via `pg` + TypeORM
- **Choice**: `pg` driver, `DATABASE_URL` env var, `synchronize: true` in dev only
- **Rationale**: More complex relational schema than home-auth; PostgreSQL is production-grade

### AD-3: Custom health endpoint
- **Choice**: `HealthController` injects `DataSource`, runs `SELECT 1`
- **Rationale**: No functional benefit from `@nestjs/terminus` at this stage

### AD-4: Env validation via `@nestjs/config` + Joi
- **Choice**: `ConfigModule.forRoot({ validationSchema: Joi.object({...}) })`
- **Rationale**: Fail-fast at startup with clear message if required vars absent

### AD-5: Global prefix `/api` + Vite proxy
- **Choice**: NestJS global prefix `api`; Vite dev proxy `/api` → `localhost:3000`
- **Rationale**: Clean separation in dev; transparent in production

### AD-6: Simpler Dockerfile (no Litestream)
- **Choice**: 3-stage build, `CMD ["node", "dist/main.js"]` directly
- **Rationale**: No SQLite; no entrypoint script needed

## Affected Files

| File | Purpose |
|------|---------|
| `package.json` | Root monorepo workspaces + scripts + toolchain |
| `Dockerfile` | 3-stage: frontend-build → backend-build → runtime |
| `backend/src/main.ts` | Bootstrap with global prefix, ValidationPipe, CORS |
| `backend/src/app.module.ts` | ConfigModule + TypeOrmModule + HealthModule + ServeStaticModule |
| `backend/src/health/health.controller.ts` | `GET /api/health` with SELECT 1 probe |
| `frontend/src/App.tsx` | Placeholder React app with Tailwind |

## Implementation Phases

### Phase 1: Root scaffold
Root `package.json`, toolchain config, Husky hooks, `.gitignore`, `.dockerignore`

### Phase 2: Backend skeleton
NestJS app, ConfigModule, TypeORM, HealthModule, env example

### Phase 3: Frontend skeleton
React + Vite + Tailwind, proxy config, placeholder page

### Phase 4: Docker
3-stage Dockerfile, copy-frontend script

## Verification

1. `npm install` → success
2. `npm run dev:backend` → NestJS on :3000 with Postgres
3. `GET /api/health` → `{"status":"ok","db":"ok"}`
4. `GET /api/health` (no DB) → 503 `{"status":"ok","db":"error"}`
5. `npm run dev:frontend` → Vite on :5173, proxy works
6. `docker build -t trainer .` → success
7. `tsc --noEmit` both workspaces → zero errors
