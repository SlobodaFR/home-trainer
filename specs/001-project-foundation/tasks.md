# Tasks: Project Foundation

**Plan**: specs/001-project-foundation/plan.md
**Status**: Complete
**Total**: 12 tasks across 4 phases

## Phase 1: Root Scaffold

- [x] **T-1.1**: Create root `package.json` with npm workspaces
  - **Do**: `package.json` — workspaces `[backend, frontend]`, scripts `dev:backend/frontend/build/test/lint`, lint-staged config, devDeps (husky, prettier, commitlint)
  - **Test**: `npm install` → no errors; `ls node_modules` shows root deps

- [x] **T-1.2**: Add toolchain config files
  - **Do**: `.nvmrc` (20), `.prettierrc.json`, `.prettierignore`, `commitlint.config.js`
  - **Test**: `npx prettier --check .` runs without config errors

- [x] **T-1.3**: Add Husky hooks
  - **Do**: `.husky/pre-commit` (lint-staged), `.husky/pre-push` (npm test), `.husky/commit-msg` (commitlint)
  - **Test**: Hooks exist and are executable; `git init && git add . && git commit` triggers lint-staged

- [x] **T-1.4**: Add `.gitignore` and `.dockerignore`
  - **Do**: `.gitignore` (node_modules, dist, .env, coverage), `.dockerignore` (node_modules, .git, .env, coverage, specs)
  - **Test**: Files exist with correct exclusions

## Phase 2: Backend Skeleton

- [x] **T-2.1**: Create backend `package.json` and TypeScript/NestJS config
  - **Do**: `backend/package.json` (NestJS + TypeORM + pg + @nestjs/config + joi + @nestjs/swagger), `backend/tsconfig.json` (strict + decorators), `backend/tsconfig.build.json`, `backend/nest-cli.json`, `backend/eslint.config.mjs`
  - **Test**: `cd backend && npx tsc --noEmit` → zero errors

- [x] **T-2.2**: Create `backend/.env.example`
  - **Do**: Document `DATABASE_URL`, `APP_URL`, `PORT`, `NODE_ENV` with examples
  - **Test**: File exists; every var referenced in code is present

- [x] **T-2.3**: Bootstrap NestJS `main.ts`
  - **Do**: `backend/src/main.ts` — global prefix `api`, `ValidationPipe`, CORS from `APP_URL`, Swagger at `/api/docs`, listen on `PORT`
  - **Test**: `npm run dev:backend` starts without error (with valid DATABASE_URL)

- [x] **T-2.4**: Create `AppModule` with env validation and TypeORM
  - **Do**: `backend/src/app.module.ts` — `ConfigModule` with Joi schema (`DATABASE_URL` required), `TypeOrmModule.forRootAsync` from `DATABASE_URL`, `ServeStaticModule` in production
  - **Test**: App refuses to start if `DATABASE_URL` missing; `GET /api/health` returns 200 when DB connected

- [x] **T-2.5**: Create `HealthModule` and `HealthController`
  - **Do**: `backend/src/health/health.module.ts`, `backend/src/health/health.controller.ts` — `GET /api/health`, injects `DataSource`, runs `SELECT 1`, returns `{ status, db }` / 503 on failure
  - **Test**: `npm run test:backend` → 2 tests pass

- [x] **T-2.6**: Add `copy-frontend.mjs` script and migrations placeholder
  - **Do**: `backend/scripts/copy-frontend.mjs` — copies `frontend/dist` → `backend/dist/public`; `backend/migrations/.gitkeep`
  - **Test**: Script runs without error after `npm run build:frontend`

## Phase 3: Frontend Skeleton

- [x] **T-3.1**: Create frontend `package.json` and TypeScript/Vite config
  - **Do**: `frontend/package.json` (React 19 + Vite + Tailwind + Vitest), `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`, `frontend/eslint.config.mjs`
  - **Test**: `cd frontend && npx tsc -b` → zero errors

- [x] **T-3.2**: Configure Vite proxy and Tailwind
  - **Do**: `frontend/vite.config.ts` (proxy `/api` → `localhost:3000`), `frontend/tailwind.config.ts`, `frontend/postcss.config.ts`
  - **Test**: `npm run dev:frontend` → Vite starts; `/api/health` proxied to backend

- [x] **T-3.3**: Create placeholder React app
  - **Do**: `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx` (`<h1>Trainer</h1>`), `frontend/src/index.css` (Tailwind directives), `frontend/src/vite-env.d.ts`
  - **Test**: `npm run dev:frontend` renders "Trainer" heading; `npm run build:frontend` succeeds

## Phase 4: Docker

- [x] **T-4.1**: Write 3-stage Dockerfile
  - **Do**: `Dockerfile` — stage 1: frontend-build, stage 2: backend-build + copy-frontend + prune, stage 3: runtime (`node:20-bookworm-slim`, `EXPOSE 3000`, `CMD ["node", "dist/main.js"]`)
  - **Test**: `docker build -t trainer .` succeeds; `docker run -e DATABASE_URL=... -e APP_URL=... -p 3000:3000 trainer` serves React app and health endpoint
