# Spec: Exercise Library — Data Layer

**Track ID**: 003-exercise-library-data
**Roadmap ref**: F-003
**Status**: Complete
**Created**: 2026-07-05
**Branch**: feat/003-exercise-library-data
**PRD sections**: FR-8, Integrations (Wger, Everkinetic)
**Depends on**: F-001 (Complete)

## Context

No exercise catalog exists. The planning engine (F-005) and execution UI (F-008) both need a stable, queryable exercise library. This feature seeds that library from Wger's public REST API, exposes it via two read-only endpoints, and bundles the Everkinetic SVG diagrams into the frontend static assets. F-004 (Browse UI) builds directly on top of this.

Wger is the source of truth for exercise data. The seed is a one-shot import: exercises are written to local PostgreSQL and never re-fetched at runtime.

## User Stories

- As a developer, I want a populated `exercises` table so the planner and execution screens can reference real exercises
- As a user, I want to query exercises by muscle group and/or equipment so I can find relevant exercises quickly
- As a user, I want to fetch a single exercise by ID so I can display its full detail (instructions, diagram, video link)

## Functional Requirements

### FR-1: Exercise entity

An `exercises` table with the following columns:

- `id` — UUID primary key (local)
- `wger_id` — integer, unique, nullable (Wger exercise ID — null for manually added exercises)
- `name` — text, unique
- `description` — text (HTML from Wger, stored as-is)
- `muscle_groups` — `text[]` (PostgreSQL array, e.g. `["biceps", "back"]`)
- `equipment` — `text[]` (e.g. `["barbell", "dumbbell"]`)
- `youtube_url` — text, nullable (manually set, not from Wger)
- `everkinetic_slug` — text, nullable (maps to `/assets/everkinetic/{slug}.svg` in frontend)
- `created_at` — `timestamptz`

### FR-2: Wger seed script

A standalone NestJS CLI script (`backend/src/seed/wger-seed.ts`) that:

1. Fetches all English exercises from `https://wger.de/api/v2/exercise/?format=json&language=2&limit=100` (paginated)
2. Fetches muscle name lookup from `GET /api/v2/muscle/`
3. Fetches equipment name lookup from `GET /api/v2/equipment/`
4. Upserts each exercise into local DB using `wger_id` as the natural key (idempotent — safe to re-run)
5. Skips exercises with no name
6. Resolves muscle/equipment IDs to name strings before storing

The script is invoked via `npm run seed:wger --workspace=backend` and is NOT run automatically on startup.

### FR-3: `GET /api/exercises`

Returns a paginated list of exercises. Authenticated (JWT cookie).

Query params:

- `muscleGroup` (optional) — filter: returned exercises must include this muscle group in `muscle_groups[]`
- `equipment` (optional) — filter: returned exercises must include this in `equipment[]`
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

Response:

```json
{
  "data": [
    {
      "id": "...",
      "name": "...",
      "muscleGroups": [],
      "equipment": [],
      "everkineticSlug": "..."
    }
  ],
  "total": 120,
  "page": 1,
  "limit": 20
}
```

### FR-4: `GET /api/exercises/:id`

Returns full exercise detail. Authenticated.

Response:

```json
{
  "id": "...",
  "name": "...",
  "description": "...",
  "muscleGroups": [],
  "equipment": [],
  "youtubeUrl": null,
  "everkineticSlug": "...",
  "createdAt": "..."
}
```

Returns 404 if not found.

### FR-5: Everkinetic SVG assets

Everkinetic muscle diagrams are open-source SVGs (https://github.com/everkinetic/data). A subset of SVGs (front + back body map, key muscle groups) is copied into `frontend/public/everkinetic/` so the UI can serve them as `/everkinetic/{slug}.svg`.

No runtime fetch — static files served by Vite in dev and by NestJS `ServeStaticModule` in production.

## API Endpoints

| Method | Path                 | Auth | Purpose                                |
| ------ | -------------------- | ---- | -------------------------------------- |
| GET    | `/api/exercises`     | JWT  | List exercises (filterable, paginated) |
| GET    | `/api/exercises/:id` | JWT  | Single exercise detail                 |

## Error Scenarios

- Wger API unreachable during seed: script logs the error and exits non-zero (retryable manually)
- Wger API rate limit hit during seed: add 500ms delay between paginated requests
- `GET /exercises/:id` with unknown ID: 404 `{ message: "Exercise not found" }`
- Invalid `limit` param (> 100 or < 1): 400 from `ValidationPipe`
- DB unavailable: NestJS default 500

## Acceptance Criteria

- [ ] AC-1: `npm run seed:wger --workspace=backend` runs without error on a clean DB and populates `exercises` with ≥ 50 rows
- [ ] AC-2: Re-running the seed script on a populated DB is idempotent (no duplicates, no errors)
- [ ] AC-3: `GET /api/exercises` without params returns paginated list with correct `total`, `page`, `limit` fields
- [ ] AC-4: `GET /api/exercises?muscleGroup=biceps` returns only exercises whose `muscleGroups` array includes `"biceps"`
- [ ] AC-5: `GET /api/exercises?equipment=barbell` returns only exercises whose `equipment` array includes `"barbell"`
- [ ] AC-6: `GET /api/exercises/:id` returns full detail for a known ID
- [ ] AC-7: `GET /api/exercises/:id` with unknown ID returns 404
- [ ] AC-8: `GET /api/exercises` with `limit=101` returns 400
- [ ] AC-9: `GET /api/exercises` without auth cookie returns 401
- [ ] AC-10: Everkinetic SVG files present at `frontend/public/everkinetic/` and accessible at `/everkinetic/{slug}.svg` in dev

## Out of Scope

- Custom (user-added) exercises — future feature
- Exercise editing / CRUD — read-only catalog for now
- Everkinetic SVG for every exercise — only bundle the diagrams that exist in the open-source dataset; exercises without a matching slug show no diagram
- Favorites and preference weighting — FR-9, planned for F-004
- YouTube URL population — manually set post-seed, not part of this feature
- Full-text search — filter by exact muscle group / equipment string only

## Open Questions

- None
