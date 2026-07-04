# Spec: Project Foundation

**Track ID**: 001-project-foundation
**Roadmap ref**: F-001
**Status**: Complete
**Created**: 2026-07-04
**Branch**: feat/001-project-foundation
**PRD sections**: Architecture & Tech Stack, Configuration
**Depends on**: None

## Context

No project exists yet. This feature creates the monorepo scaffold, connects the database, and validates the Docker build. Every subsequent feature builds on this foundation. Mirrors the structure of `home-auth` so conventions are familiar.

## User Stories

- As a developer, I want a single `npm install` at root to bootstrap both apps
- As a developer, I want `docker build .` to produce a working image (backend serves built frontend)
- As a developer, I want `GET /health` to confirm the API and database are reachable
- As a developer, I want a `.env.example` that documents every required variable

## Functional Requirements

### FR-1: Monorepo with npm workspaces
Root `package.json` declares workspaces `backend` and `frontend`. Scripts `dev:backend` and `dev:frontend` start each app independently.

### FR-2: NestJS backend skeleton
NestJS app on port 3000. Single `AppModule` with one endpoint: `GET /health` returning `{ status: "ok", db: "ok" }`. TypeORM configured and connected to PostgreSQL. `NestJS Logger` used (no `console.log`). Strict TypeScript.

### FR-3: React + Vite frontend skeleton
React 18 + Vite + TypeScript + Tailwind CSS on port 5173. Dev server proxies `/api` to `localhost:3000`. Single page: "Trainer" heading. No routing yet.

### FR-4: PostgreSQL via TypeORM
TypeORM `DataSource` configured from `DATABASE_URL`. `synchronize: false` in production, `true` in dev. No entities yet beyond a placeholder `migrations/` folder. Connection verified in health endpoint.

### FR-5: Docker single-image build
Multi-stage Dockerfile:
1. Build frontend (`npm run build` in `frontend/`)
2. Build backend (`npm run build` in `backend/`)
3. Production image: Node.js, backend dist, frontend dist copied to `backend/dist/public`, served as static by NestJS `ServeStaticModule`

### FR-6: Environment configuration
`backend/.env.example` documents all variables (at minimum: `DATABASE_URL`, `APP_URL`, `NODE_ENV`). App fails fast on startup if required vars are absent.

## Error Scenarios

- `DATABASE_URL` missing or malformed → app refuses to start with clear error message
- DB unreachable at startup → `GET /health` returns `{ status: "ok", db: "error" }` with HTTP 503
- Docker build with missing env → build succeeds; runtime fails fast on container start

## Acceptance Criteria

- [ ] AC-1: `npm install` at root installs all dependencies for both workspaces
- [ ] AC-2: `npm run dev:backend` starts NestJS on port 3000
- [ ] AC-3: `npm run dev:frontend` starts Vite on port 5173; `/api/health` proxied correctly
- [ ] AC-4: `GET /health` returns `{ status: "ok", db: "ok" }` when DB is connected
- [ ] AC-5: `GET /health` returns HTTP 503 when DB is unreachable
- [ ] AC-6: `docker build .` succeeds and `docker run` serves the React app on port 3000
- [ ] AC-7: App exits with a meaningful error if `DATABASE_URL` is missing
- [ ] AC-8: `backend/.env.example` exists with all required variables documented
- [ ] AC-9: `tsc --noEmit` passes with zero errors in both workspaces
- [ ] AC-10: No `console.log` in any source file

## Out of Scope

- Auth (F-002)
- Any domain entities or business logic
- CI/CD pipeline
- Nginx or reverse proxy config (user manages their own VPS setup)
- docker-compose (user already has a VPS workflow)

## Open Questions

- None
