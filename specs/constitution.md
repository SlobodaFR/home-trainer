# Project Constitution

> Non-negotiable principles for **Trainer**. Reject any PR that violates these.

## 1. Project Context

Personal strength & mobility training app for a single user. Goal-driven session planning, workout execution logging, and async LLM progress analysis. Deployed on a self-hosted VPS via Docker. Auth delegated entirely to home-auth (existing SSO infrastructure).

## 2. Non-Negotiable Principles

1. **Every API endpoint requires a valid JWT.** No unauthenticated routes except `/health` and OAuth2 callbacks.
2. **JWTs validated against JWKS only.** Never accept tokens without verifying against `AUTH_BASE_URL/.well-known/jwks.json`.
3. **No secrets in code or logs.** API keys, client secrets, and tokens must come from env vars. Never log them.
4. **No PII stored beyond `userId`.** User identity comes from the JWT claim; nothing else is persisted.
5. **Session data is never lost silently.** Workout logs must be retained in local state on save failure; surface a toast warning.
6. **LLM calls are async only.** No LLM call may block an HTTP response. Jobs are persisted in DB before dispatch.
7. **LLM failure = degrade gracefully.** Show fallback UI; allow 1 retry. Session data is unaffected.
8. **All env vars from `.env.example`.** Every required variable must be documented there. No undocumented runtime dependency.
9. **CORS restricted to `APP_URL`.** Never use `*` as CORS origin in non-dev environments.
10. **Logout webhook implemented.** `POST /auth/logout-webhook` must invalidate the user's local session/tokens.

## 3. Tech Stack

| Component | Choice | Locked? |
|-----------|--------|---------|
| Frontend | React + Vite + TypeScript + Tailwind | Locked |
| Backend | NestJS + TypeORM | Locked |
| Database | PostgreSQL | Locked |
| Monorepo | npm workspaces (`backend`, `frontend`) | Locked |
| Container | Docker (single image) | Locked |
| Auth provider | home-auth OAuth2 + JWT RS256 | Locked |
| LLM interface | `LLMService` abstraction (OpenAI default) | Flexible (provider swap OK) |
| Exercise seed | Wger API → local DB | Flexible (source can change) |

## 4. Coding Standards

- **TypeScript strict mode** on both frontend and backend. No `any` without a comment explaining why.
- **NestJS module per domain** — `auth`, `exercises`, `goals`, `sessions`, `analysis`. No cross-module direct imports; use injected services.
- **TypeORM entities are the schema source of truth.** No raw SQL migrations written by hand.
- **No business logic in controllers.** Controllers call services only; services call repositories.
- **React: one component per file.** Co-locate its types in the same file.
- **No `console.log` in production code.** Use NestJS `Logger` on backend; silence on frontend.
- **LLM prompts defined in constants**, not inline strings. Stored in `src/analysis/prompts.ts`.

## 5. Quality Gates

Every PR must pass ALL of the following:

- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] All new API endpoints have a corresponding NestJS guard or are explicitly marked public with justification
- [ ] No new env var introduced without an entry in `backend/.env.example`
- [ ] LLM calls go through `LLMService`, never directly to provider SDK
- [ ] Session save paths handle failure (optimistic local state retained)
- [ ] No `any` added without inline comment
- [ ] Docker build succeeds (`docker build .`)

## 6. Compliance & Security

- **Transport**: HTTPS only in production. Docker deployment must sit behind a TLS-terminating reverse proxy.
- **Auth flow**: OAuth2 Authorization Code (PKCE recommended). Tokens stored in `httpOnly` cookies or secure memory — never `localStorage`.
- **Dependency provenance**: No new dependency added without checking it is actively maintained and has no known critical CVEs.
- **LLM data minimization**: Only session data (exercises, sets, reps, RPE, notes) sent to LLM. No full user profile or PII.
