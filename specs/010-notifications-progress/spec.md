# Spec: Notifications & Progress History

**Track ID**: 010-notifications-progress
**Roadmap ref**: F-010
**Status**: Complete
**Created**: 2026-07-07
**Branch**: feat/010-notifications-progress
**PRD sections**: FR-10, FR-11
**Depends on**: F-008 Session Execution UI — Complete, F-009 LLM Analysis — Complete

## Context

F-009 delivers the async LLM job and the `GET /analyses/:sessionId` endpoint, but the user has no way to know when an analysis is ready — they would have to manually navigate and refresh. This feature closes that gap: the UI polls for analysis status after session finish, surfaces a notification when it's ready, and adds a progress history page where past sessions and their analyses can be reviewed over time.

## User Stories

- As a user, I want to see a notification when my session analysis is ready so I don't have to manually check
- As a user, I want to read the full analysis text when it's ready so I can act on the feedback
- As a user, I want to retry a failed analysis from the UI so I'm not stuck without feedback
- As a user, I want to browse my past sessions with their volume and analysis so I can track progress over time

## Functional Requirements

### FR-1: Analysis status polling after session finish

After finishing a session (RPE modal submitted), the frontend polls `GET /api/analyses/:sessionId` at a fixed interval (5s) until status is `done` or `failed`. Max poll duration: 90s, then give up and show a "check later" state.

### FR-2: In-app notification banner

When polling resolves to `done`, a dismissible banner appears (e.g., "Analyse prête — Voir les résultats"). Clicking it navigates to the session detail page which now includes the analysis panel.

When status is `failed`, the banner shows "Analyse indisponible" with a "Réessayer" button that calls `POST /api/analyses/:sessionId/retry` then restarts polling.

### FR-3: Analysis panel on SessionDetailPage

`SessionDetailPage` gains an analysis section at the bottom:

- `pending`: spinner + "Analyse en cours…"
- `done`: Markdown-rendered analysis text
- `failed`: error message + "Réessayer" button
- Not yet started (no analysis record): hidden

### FR-4: Progress history page

New page at `/history`. Shows a reverse-chronological list of completed sessions. Each row displays:

- Date
- Exercises (names only, comma-separated)
- Total volume (sum of `reps × weightKg` across all sets, or set count if no weight)
- Analysis status chip (`done` / `failed` / `pending` / none)

Clicking a row navigates to `SessionDetailPage` (already exists), where the analysis panel is visible.

### FR-5: Navigation link

NavBar gains a "Historique" link pointing to `/history`.

## API Endpoints Involved

| Method | Path                             | Purpose                                                                                      |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/api/analyses/:sessionId`       | Poll analysis status + result                                                                |
| POST   | `/api/analyses/:sessionId/retry` | Retry failed analysis                                                                        |
| GET    | `/api/sessions?status=completed` | Fetch completed sessions enriched with `volumeKg` and `analysisStatus` (backend aggregation) |

## Design References

| Surface                            | Components used                         | New components needed                                            |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| SessionDetailPage — analysis panel | `button-primary`, `button-secondary`    | `AnalysisPanel` (new, renders Markdown + status states)          |
| HistoryPage                        | `filter-chip` (status filter, optional) | `SessionHistoryRow` (new — date, exercises, volume, status chip) |
| Notification banner                | `button-primary`, `button-secondary`    | `AnalysisBanner` (new — dismissible, fixed bottom or top)        |
| NavBar                             | existing nav link pattern               | none                                                             |

## Error Scenarios

- **Polling timeout (90s without done/failed)**: show "L'analyse prend plus de temps que prévu. Réessayez plus tard." — stop polling.
- **Retry call fails (network)**: show toast "Impossible de relancer l'analyse".
- **History page load fails**: show empty state with "Impossible de charger l'historique".
- **Sets fetch fails for a session row**: show "—" for volume, don't block the row.

## Acceptance Criteria

- [ ] AC-1: After finishing a session, the UI polls `GET /analyses/:sessionId` every 5s
- [ ] AC-2: When analysis status becomes `done`, a dismissible banner appears
- [ ] AC-3: Clicking the banner navigates to SessionDetailPage which shows the analysis text (Markdown rendered)
- [ ] AC-4: When status is `failed`, banner shows "Réessayer" button; clicking it calls retry endpoint and resumes polling
- [ ] AC-5: Polling stops after 90s if no terminal status reached; shows "check later" message
- [ ] AC-6: `SessionDetailPage` shows an analysis panel (spinner / text / error+retry) below the sets list
- [ ] AC-7: `/history` page lists completed sessions in reverse-chronological order with date, exercises, volume, analysis status
- [ ] AC-8: Clicking a history row navigates to `SessionDetailPage`
- [ ] AC-9: NavBar shows "Historique" link to `/history`
- [ ] AC-10: Analysis panel uses design tokens only — no raw hex values

## Out of Scope

- Push notifications (browser or mobile)
- SSE / WebSockets (polling is sufficient for single user)
- Volume charts / trend graphs (future feature)
- Filtering/sorting history (v1 is reverse-chronological only)
- Pagination (all completed sessions in one list for now)

## Open Questions

_All resolved._

- **OQ-1** → Fixed top banner (status bar style, dismissible)
- **OQ-2** → Backend aggregation: `GET /api/sessions?status=completed` returns `volumeKg` and `analysisStatus` fields alongside each session
- **OQ-3** → `react-markdown` (standard, handles lists/bold/headings from LLM output cleanly)
