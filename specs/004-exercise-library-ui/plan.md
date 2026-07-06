# Plan: Exercise Library — UI

**Spec**: specs/004-exercise-library-ui/spec.md

> ⚠ No CLAUDE.md found — plan derived from observed codebase patterns.

## Open Questions Resolved

- **Preference weight UI**: stars (5 clickable) on detail page only — no stars on list card
- **Everkinetic viewer**: tension + relaxation images side-by-side (flex row) — both diagrams visible at a glance
- **Pagination**: "Load more" button — fits browse UX, no page number needed

## Architecture Decisions

### AD-1: UserExercise entity — composite PK (userId, exerciseId)

- **Choice**: `user_exercises` table with `(user_id, exercise_id)` composite PK, `is_favorite BOOLEAN DEFAULT 0`, `preference_weight INTEGER NULL` (1–5). SQLite, no FK constraints (TypeORM doesn't enforce them on SQLite anyway).
- **Rationale**: Single-user app, but keeping userId in the table keeps the schema clean for potential future multi-user support and matches the `users` table already present.
- **Alternatives**: Boolean column directly on `exercises` — rejected, pollutes the exercise catalog with user-specific data.

### AD-2: GetExercises / GetExerciseById enriched with UserExercise data

- **Choice**: Both use cases accept `userId: string` and fetch the corresponding `UserExercise` row to merge `isFavorite` and `preferenceWeight` into the response.
- **Rationale**: Avoids a separate API roundtrip from the frontend to get preference state.
- **Alternatives**: Separate `GET /api/exercises/:id/preference` endpoint — extra roundtrip, more complex frontend state.

### AD-3: @CurrentUser() injected into ExerciseController

- **Choice**: Add `@CurrentUser() user: CurrentUserPayload` to `list` and `detail` handlers. Favorite/preference endpoints also use it.
- **Rationale**: APP_GUARD already validates auth — `@CurrentUser()` just extracts the already-verified payload.

### AD-4: Optimistic UI for favorite toggle

- **Choice**: Toggle `isFavorite` in local state immediately on click, then call the API. Revert + show toast on failure.
- **Rationale**: Instant feedback, matches expected UX for a toggle. Single-user so no conflict risk.

### AD-5: Toast via shared hook — no external library

- **Choice**: `useToast()` hook backed by React state + auto-dismiss `setTimeout`. Single toast slot — new toast replaces old.
- **Rationale**: No Sonner/react-hot-toast dep. The use case (error feedback only) is narrow enough that a DIY implementation stays under 30 lines.

### AD-6: Tailwind classes map to DESIGN.md tokens

- **Choice**: Map tokens directly in JSX via Tailwind utilities. Add `ink`, `canvas`, `soft-cloud` as custom colors in `tailwind.config.ts`.
- Mapping: `{colors.ink}` → `bg-ink` / `text-ink`, `{colors.soft-cloud}` → `bg-soft-cloud`, `{rounded.full}` → `rounded-full`, `{rounded.lg}` 30px → `rounded-[30px]`.
- **Rationale**: One-time config change makes token names first-class in JSX, preventing raw hex drift.

### AD-7: Exercise API client separate from auth api-client

- **Choice**: New `frontend/src/infrastructure/exercise-client.ts` — standalone fetch wrapper, not merged into `api-client.ts`.
- **Rationale**: `api-client.ts` owns auth concerns. Mixing exercise calls would make it a god file.

## Affected Files

### New Files — Backend

| File                                                                                      | Purpose                                                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `backend/src/domain/exercise/user-exercise.ts`                                            | Domain interface `UserExercise { userId, exerciseId, isFavorite, preferenceWeight }` |
| `backend/src/domain/exercise/user-exercise.repository.ts`                                 | Abstract `UserExerciseRepository`                                                    |
| `backend/src/infrastructure/persistence/entities/user-exercise.orm-entity.ts`             | `user_exercises` ORM entity, composite PK                                            |
| `backend/src/infrastructure/persistence/repositories/typeorm-user-exercise.repository.ts` | TypeORM implementation                                                               |
| `backend/src/application/exercise/toggle-favorite.use-case.ts`                            | Upsert `isFavorite` for (userId, exerciseId)                                         |
| `backend/src/application/exercise/toggle-favorite.use-case.spec.ts`                       | Unit tests                                                                           |
| `backend/src/application/exercise/set-preference.use-case.ts`                             | Upsert `preferenceWeight` for (userId, exerciseId)                                   |
| `backend/src/application/exercise/set-preference.use-case.spec.ts`                        | Unit tests                                                                           |
| `backend/src/interfaces/http/dto/set-preference.dto.ts`                                   | `@IsInt @Min(1) @Max(5) weight`                                                      |

### New Files — Frontend

| File                                                         | Purpose                                  |
| ------------------------------------------------------------ | ---------------------------------------- |
| `frontend/src/infrastructure/exercise-client.ts`             | All exercise API calls                   |
| `frontend/src/presentation/exercises/ExercisesPage.tsx`      | `/exercises` route — list + filters      |
| `frontend/src/presentation/exercises/ExerciseDetailPage.tsx` | `/exercises/:id` route                   |
| `frontend/src/presentation/exercises/ExerciseCard.tsx`       | Card: name, muscle tags, favorite icon   |
| `frontend/src/presentation/exercises/FilterChips.tsx`        | Muscle group + equipment filter chips    |
| `frontend/src/presentation/exercises/EverkineticViewer.tsx`  | Tension + relaxation SVGs stacked        |
| `frontend/src/presentation/exercises/PreferenceWeight.tsx`   | 5-star preference selector               |
| `frontend/src/presentation/exercises/FavoriteButton.tsx`     | Heart toggle, optimistic, toast on error |
| `frontend/src/presentation/shared/Toast.tsx`                 | Auto-dismiss error toast                 |
| `frontend/src/presentation/shared/useToast.ts`               | Toast state hook                         |

### Modified Files

| File                                                                   | Change                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `backend/src/domain/exercise/exercise.repository.ts`                   | Add `userId` param; return type gains `isFavorite`, `preferenceWeight`         |
| `backend/src/application/exercise/get-exercises.use-case.ts`           | Accept + pass `userId`; merge UserExercise data                                |
| `backend/src/application/exercise/get-exercises.use-case.spec.ts`      | Update tests for enriched return                                               |
| `backend/src/application/exercise/get-exercise-by-id.use-case.ts`      | Accept + pass `userId`; merge UserExercise data                                |
| `backend/src/application/exercise/get-exercise-by-id.use-case.spec.ts` | Update tests                                                                   |
| `backend/src/interfaces/http/controllers/exercise.controller.ts`       | Add `@CurrentUser()`, add `POST/DELETE /:id/favorite`, `PATCH /:id/preference` |
| `backend/src/interfaces/http/controllers/exercise.controller.spec.ts`  | Update + add tests                                                             |
| `backend/src/exercise/exercise.module.ts`                              | Add UserExercise entity + repository + new use cases                           |
| `backend/src/app.module.ts`                                            | Add `UserExerciseOrmEntity` to TypeORM entities                                |
| `frontend/src/App.tsx`                                                 | Add `/exercises` and `/exercises/:id` routes inside `RequireAuth`              |
| `frontend/tailwind.config.ts`                                          | Add `ink`, `canvas`, `soft-cloud`, `mute` custom colors                        |

## Implementation Phases

### Phase 1: Backend — UserExercise domain + persistence

- `user-exercise.ts` domain interface
- `user-exercise.repository.ts` abstract class
- `user-exercise.orm-entity.ts`: composite PK `(user_id TEXT, exercise_id TEXT)`, `is_favorite INTEGER DEFAULT 0`, `preference_weight INTEGER NULL`
- `typeorm-user-exercise.repository.ts`: `findByUserAndExercise`, `upsert`

### Phase 2: Backend — ToggleFavorite + SetPreference use cases

- `toggle-favorite.use-case.ts` + spec
- `set-preference.use-case.ts` + spec
- `set-preference.dto.ts`

### Phase 3: Backend — Enrich GetExercises + controller

- Update `GetExercisesUseCase` + `GetExerciseByIdUseCase` to accept `userId`, fetch and merge UserExercise
- Update `ExerciseController`: inject `@CurrentUser()`, wire new endpoints
- Update `ExerciseModule` + `AppModule`
- Update specs

### Phase 4: Frontend — Infrastructure + shared

- `exercise-client.ts`: typed fetch wrappers for all 5 endpoints
- `tailwind.config.ts`: custom colors
- `Toast.tsx` + `useToast.ts`
- `App.tsx`: add routes

### Phase 5: Frontend — Exercise list page

- `FilterChips.tsx`: muscle group + equipment chips using `filter-chip` / `filter-chip-active` pattern
- `ExerciseCard.tsx`: name (`{typography.heading-md}`), muscle tags (`{typography.caption-md}` `{colors.mute}`), `FavoriteButton` icon
- `ExercisesPage.tsx`: fetch on filter change, "Load more", loading + empty + error states

### Phase 6: Frontend — Exercise detail page

- `EverkineticViewer.tsx`: tension + relaxation `<img>` side-by-side in a flex row, hidden if no slug
- `PreferenceWeight.tsx`: 5 star buttons, filled/empty state, calls `exerciseClient.setPreference`
- `FavoriteButton.tsx`: heart icon, optimistic toggle, reverts on error with toast
- `ExerciseDetailPage.tsx`: fetch by id, layout (name, instructions, viewer, YouTube iframe, favorite + stars)

## Design Mobilization

- **Tokens used**: `{colors.ink}`, `{colors.canvas}`, `{colors.soft-cloud}`, `{colors.mute}`, `{colors.success}` (favorite active), `{typography.heading-md}`, `{typography.body-md}`, `{typography.caption-md}`, `{typography.button-md}`, `{spacing.sm}`, `{spacing.xl}`, `{spacing.section}`, `{rounded.full}`, `{rounded.lg}`
- **Components used**: `filter-chip`, `filter-chip-active`, `button-primary` (Load more), `button-icon-circular` (favorite, back)
- **New components**: `exercise-card` (adapts `product-card` — flat, no shadow, soft-cloud bg), `everkinetic-viewer`, `preference-weight-input`
- **Surfaces touched**: exercise list page (`/exercises`), exercise detail page (`/exercises/:id`)
- **States covered**:
  - loading: skeleton or spinner on list and detail fetch
  - empty: "Aucun exercice trouvé" with clear-filters CTA
  - error: toast + retry button
  - success: normal rendered state
  - offline: not handled (single-user VPS, not a PWA requirement)
- **A11y notes**: favorite button needs `aria-label="Ajouter aux favoris"` / `"Retirer des favoris"`. Star inputs need `role="radiogroup"`. Filter chips need `aria-pressed`. YouTube iframe needs `title`.

## Test Strategy

- **Mocking approach**: Jest (backend) — mock `UserExerciseRepository` and `ExerciseRepository` with jest.fn(). Frontend: no test framework exercised beyond type-check (vitest passWithNoTests).
- **Happy paths**: ToggleFavorite sets `isFavorite: true` then `false`; SetPreference saves weight 1–5; GetExercises merges UserExercise data when row exists and returns defaults when not
- **Error scenarios**: SetPreference with weight 0 or 6 → 400 from DTO validation; ToggleFavorite on unknown exerciseId → 404
- **Edge cases**: GetExercises with no UserExercise row → `isFavorite: false`, `preferenceWeight: null`

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**: TypeORM composite PK on SQLite — tested pattern in home-budget; should be fine. Optimistic UI revert logic needs care to avoid stale state if two toggles fire quickly — debounce the favorite button.
- **New dependencies**: None — Tailwind custom config only.
