# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Development
npm run dev:backend          # NestJS watch mode (port 3000)
npm run dev:frontend         # Vite dev server (port 5173)

# Tests
npm run test                 # backend Jest + frontend Vitest (runs on pre-push hook)
npm run test --workspace=backend -- --testPathPattern="use-case-name"  # single spec
npm run test --workspace=backend -- --no-coverage  # skip coverage (faster)

# Lint + format
npm run lint                 # ESLint both workspaces
npm run format               # Prettier whole repo
cd backend && npx eslint src --max-warnings=0   # backend only
cd backend && npx prettier --check "src/**/*.ts"

# Type check (excludes spec files)
npx tsc --noEmit --project backend/tsconfig.build.json
npx tsc --noEmit --project frontend/tsconfig.app.json

# Seed exercises from Wger (one-time)
npm run seed:wger --workspace=backend
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

**Session auth check pattern**: `if (session?.userId !== userId) throw new NotFoundException(...)` — optional chain, not `!session ||`.

**Error codes**: `NotFoundException` → 404, `ConflictException` → 409, class-validator `ValidationPipe` → 400.

**Database**: SQLite via `better-sqlite3`, `synchronize: true` (schema auto-migrated). DB file path from `DATABASE_PATH` env var.

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

### ESLint gotchas

- **`import/order`**: sibling imports (`./foo`) must come **before** parent imports (`../../bar`) within the relative-imports group.
- **`@typescript-eslint/prefer-optional-chain`**: `if (!x || x.foo)` → `if (x?.foo)`.
- **`@typescript-eslint/no-deprecated`**: avoid deprecated APIs (`React.FormEvent` etc.).

### Pre-commit / pre-push hooks

- **pre-commit**: lint-staged runs ESLint + Prettier on staged files.
- **pre-push**: full `npm test` (backend Jest + frontend Vitest). Must pass before push.
- Commits require conventional format: `feat(NNN): description`, `fix: ...`, `chore: ...`. No `Co-Authored-By`.
