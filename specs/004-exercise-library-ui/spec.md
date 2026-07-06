# Spec: Exercise Library — UI

**Track ID**: 004-exercise-library-ui
**Roadmap ref**: F-004
**Status**: Complete
**Created**: 2026-07-06
**Branch**: feat/004-exercise-library-ui
**PRD sections**: FR-8, FR-9
**Depends on**: F-002 (Complete), F-003 (Complete)

## Context

F-003 delivered the data layer: exercises are seeded from Wger, queryable via `GET /api/exercises` and `GET /api/exercises/:id`. F-004 makes that catalog usable: a browse/filter page, a detail view with Everkinetic SVGs and YouTube embed, and the ability to favorite exercises and set a preference weight (1–5) that will later bias the session planner (F-005).

Favorites + preference weight have no backend yet — this feature adds both the `UserExercise` entity and its endpoints alongside the frontend.

## User Stories

- As a user, I want to browse exercises filtered by muscle group and equipment so I can find relevant movements
- As a user, I want to see an exercise's instructions, muscle diagram, and video link so I know how to perform it correctly
- As a user, I want to favorite an exercise so planning prioritizes it
- As a user, I want to set a preference weight (1–5) on an exercise so I can tune how often it appears in sessions

## Functional Requirements

### FR-1: Exercise list page

Paginated grid of exercises accessible at `/exercises`. Filterable by muscle group and equipment via chips. Each card shows name, primary muscle groups, and favorite status.

**Acceptance criteria**:

- [ ] `/exercises` renders a list of exercises, authenticated
- [ ] Muscle group and equipment filter chips — selecting one reloads the list
- [ ] Each card shows exercise name, muscle group tags, favorite toggle icon
- [ ] Pagination: "Load more" or page navigation

### FR-2: Exercise detail page

`/exercises/:id` shows full exercise detail.

**Acceptance criteria**:

- [ ] Name, description/instructions rendered
- [ ] Everkinetic SVG shown (tension + relaxation tabs) when `everkineticSlug` is set; graceful fallback if not
- [ ] YouTube embed shown when `youtubeUrl` is set; hidden otherwise
- [ ] Favorite toggle + preference weight input (1–5) visible and functional

### FR-3: Favorites backend

`UserExercise` entity linking the single user to an exercise with `isFavorite` and `preferenceWeight`.

**Acceptance criteria**:

- [ ] `POST /api/exercises/:id/favorite` → creates or updates `UserExercise` with `isFavorite: true`
- [ ] `DELETE /api/exercises/:id/favorite` → sets `isFavorite: false`
- [ ] `PATCH /api/exercises/:id/preference` `{ weight: 1–5 }` → upserts `preferenceWeight`
- [ ] `GET /api/exercises` response includes `isFavorite` and `preferenceWeight` for the current user

### FR-4: API client

Frontend `exerciseClient` wrapping all exercise-related API calls.

## API Endpoints Involved

| Method | Path                            | Purpose                                                    |
| ------ | ------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/exercises`                | Paginated list with filters; enriched with user preference |
| GET    | `/api/exercises/:id`            | Full exercise detail with user preference                  |
| POST   | `/api/exercises/:id/favorite`   | Mark as favorite                                           |
| DELETE | `/api/exercises/:id/favorite`   | Unmark favorite                                            |
| PATCH  | `/api/exercises/:id/preference` | Set preference weight 1–5                                  |

## Design References

| Surface              | Components used                                                                                                | New components needed                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Exercise list page   | `filter-chip` / `filter-chip-active`, `button-primary` (load more), `button-icon-circular` (favorite heart)    | `exercise-card` (adapts `product-card` pattern)                                            |
| Exercise detail page | `button-icon-circular` (favorite, back), `button-primary` (YouTube CTA), `filter-chip` (muscle/equipment tags) | `everkinetic-viewer` (SVG tab switcher), `preference-weight-input` (1–5 star/dot selector) |

Token usage:

- Colors: `{colors.ink}`, `{colors.canvas}`, `{colors.soft-cloud}`, `{colors.mute}`, `{colors.success}` (favorite active)
- Typography: `{typography.heading-md}` (exercise name on card), `{typography.caption-md}` (muscle tags), `{typography.body-md}` (instructions)
- Spacing: `{spacing.sm}` (card gutters), `{spacing.xl}` (section gaps), `{spacing.section}` (page rhythm)
- Rounded: `{rounded.full}` (filter chips, favorite button), `{rounded.none}` (exercise card container)

## Error Scenarios

- `GET /api/exercises` fails → show error banner, retry button; list stays empty
- `GET /api/exercises/:id` 404 → redirect to `/exercises` with "Exercise not found" toast
- Favorite/preference API call fails → toast warning, UI reverts optimistic state
- Everkinetic SVG missing → hide diagram section silently (not all exercises have slugs)
- YouTube URL absent → hide embed section silently

## Acceptance Criteria

- [ ] AC-1: `/exercises` renders authenticated exercise list with muscle group + equipment filter chips
- [ ] AC-2: Selecting a filter chip reloads the list filtered accordingly; clearing it restores full list
- [ ] AC-3: Each exercise card shows name, muscle group tags, and a favorite toggle icon
- [ ] AC-4: `/exercises/:id` shows name, instructions, Everkinetic SVG (if slug exists), YouTube embed (if URL exists)
- [ ] AC-5: Favorite toggle on detail page calls the API and persists across page reload
- [ ] AC-6: Preference weight input (1–5) on detail page calls the API and persists across page reload
- [ ] AC-7: Favorite state from the list page reflects the user's persisted preference
- [ ] AC-8: All API errors surface as non-blocking toasts; UI reverts optimistic state on failure

## Out of Scope

- Text search by exercise name (backend has no text search index yet)
- Sorting the exercise list (beyond default order)
- Bulk favorite management
- Exercise creation/editing UI (exercises come from Wger seed only)

## Open Questions

- **Preference weight UI**: star rating (1–5 stars) or numbered dot selector (1 · 2 · 3 · 4 · 5)? Stars are more intuitive; dots are more compact on the card. Recommendation: stars on detail page only (not on card).
- **Everkinetic viewer**: show both SVGs side by side, or as tension/relaxation tabs? Tabs save space on mobile.
- **Pagination**: "Load more" button vs. numbered pages? Load more is simpler given no total count visibility needed.
