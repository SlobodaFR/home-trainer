# Plan: Notifications & Progress History

**Spec**: specs/010-notifications-progress/spec.md

## Architecture Decisions

### AD-1: History endpoint in AnalysisModule, not PlanningModule

- **Choice**: New `GetHistoryUseCase` in `application/analysis/`, exposed at `GET /api/history` via `AnalysisController`
- **Rationale**: `AnalysisModule` already has all required repo bindings (`SessionAnalysisRepository`, `WorkoutLogRepository`, `SessionRepository`). Adding them to `PlanningModule` would require re-binding or cross-module imports. Keeping it in `AnalysisModule` avoids circular deps.
- **Alternatives considered**: New `HistoryModule` (overkill — one use case), enrich `GET /sessions` (breaks existing contract, `planning-client.ts` type `Session` would need extensions)

### AD-2: AnalysisContext for cross-page banner state

- **Choice**: React context `AnalysisContext` at `App.tsx` level holds `{ pendingSessionId: string | null, setPending }`. After finish, `ExecutionPage` calls `setPending(id)` then navigates to `/sessions/:id`. `AnalysisBanner` (rendered outside `<Routes>` in the auth wrapper) reads context and runs the polling hook.
- **Rationale**: The banner must persist while user navigates (e.g., from `/sessions/:id` to `/`). Context at App level is the minimal-state solution — no localStorage, no SSE, no global store.
- **Alternatives considered**: Store sessionId in `sessionStorage` (survives refresh but adds complexity); navigate straight to `/sessions/:id` only (no cross-page persistence)

### AD-3: Polling in custom hook `useAnalysisPoller`

- **Choice**: `useAnalysisPoller(sessionId: string | null)` — `setInterval` at 5s, clears on 90s timeout, returns `{ status, result, stop, retry }`. Retry resets timer and calls `POST /api/analyses/:sessionId/retry`.
- **Rationale**: Encapsulates all polling state machine logic, easily testable, usable from both `AnalysisBanner` and `AnalysisPanel`
- **Alternatives considered**: SSE (overkill for single user + adds backend streaming infra)

### AD-4: Volume calculation in backend (`GetHistoryUseCase`)

- **Choice**: Use case fetches all completed sessions for user, then `workoutLogRepository.findBySession(sessionId)` for each, computes `sum(repsCompleted * weightKg)` where both are non-null, else `sum(repsCompleted ?? 0)` as fallback set count
- **Rationale**: Frontend stays dumb; no N+1 in client; consistent calculation across surfaces
- **Alternatives considered**: Frontend fetch per session (N+1, fragile); SQL aggregate (TypeORM `synchronize: true` makes raw queries risky)

### AD-5: react-markdown for analysis rendering

- **Choice**: Add `react-markdown` dep. Used only in `AnalysisPanel`.
- **Rationale**: LLM output uses Markdown (lists, bold, headings). `react-markdown` is the de facto standard; `<pre>` would lose formatting.
- **Alternatives considered**: `marked` + `dangerouslySetInnerHTML` (XSS risk without sanitizer)

### AD-6: ExecutionPage navigates to `/sessions/:id` after finish

- **Choice**: Change `navigate('/')` → `navigate(\`/sessions/${id}\`)` after successful finish
- **Rationale**: User lands directly on the session detail page where the analysis panel shows `pending` state immediately. Combined with context banner, they get two feedback surfaces.
- **Alternatives considered**: Keep navigating to `/` (user sees nothing about analysis state)

## Affected Files

### New Files

| File                                                            | Purpose                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `backend/src/application/analysis/get-history.use-case.ts`      | Returns `HistoryEntry[]` with `volumeKg` and `analysisStatus` |
| `backend/src/application/analysis/get-history.use-case.spec.ts` | Tests for history use case                                    |
| `frontend/src/infrastructure/analysis-client.ts`                | `getAnalysis()`, `retryAnalysis()`, `getHistory()`            |
| `frontend/src/presentation/shared/AnalysisContext.tsx`          | React context for cross-page pending analysis state           |
| `frontend/src/presentation/shared/AnalysisBanner.tsx`           | Fixed-top dismissible banner with polling                     |
| `frontend/src/presentation/shared/AnalysisPanel.tsx`            | Inline panel for `SessionDetailPage` (spinner/markdown/retry) |
| `frontend/src/presentation/shared/useAnalysisPoller.ts`         | Custom hook: polls every 5s, 90s timeout                      |
| `frontend/src/presentation/shared/useAnalysisPoller.spec.ts`    | Unit tests for poller hook                                    |
| `frontend/src/presentation/planning/HistoryPage.tsx`            | `/history` — completed sessions list                          |

### Modified Files

| File                                                                  | Change                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `backend/src/application/analysis/get-history.use-case.ts`            | (new — see above)                                                  |
| `backend/src/analysis/analysis.module.ts`                             | Add `GetHistoryUseCase` provider                                   |
| `backend/src/interfaces/http/controllers/analysis.controller.ts`      | Add `GET history` endpoint                                         |
| `backend/src/interfaces/http/controllers/analysis.controller.spec.ts` | (new) Test GET /history                                            |
| `frontend/src/App.tsx`                                                | Add `AnalysisContext` provider, `AnalysisBanner`, `/history` route |
| `frontend/src/presentation/shared/NavBar.tsx`                         | Add "Historique" link                                              |
| `frontend/src/presentation/planning/SessionDetailPage.tsx`            | Add `AnalysisPanel` below exercises list                           |
| `frontend/src/presentation/execution/ExecutionPage.tsx`               | Set pending context + navigate to `/sessions/:id` after finish     |
| `frontend/package.json`                                               | Add `react-markdown` dependency                                    |

## Implementation Phases

### Phase 1: Backend — history endpoint

- `HistoryEntry` type (inline in use case — no domain file needed, it's a read model)
- `GetHistoryUseCase`: fetch completed sessions, compute volume per session, attach `analysisStatus`
- `GET /api/history` in `AnalysisController`
- Spec: `get-history.use-case.spec.ts`

### Phase 2: Frontend infrastructure

- `analysis-client.ts`: `getAnalysis`, `retryAnalysis`, `getHistory` with typed responses
- `useAnalysisPoller` hook + spec

### Phase 3: Frontend — notification banner

- `AnalysisContext` provider
- `AnalysisBanner` component (fixed top, reads context, uses poller)
- Wire into `App.tsx` (context provider wraps everything; banner rendered inside auth wrapper above `<Routes>`)
- `ExecutionPage`: set context + navigate to `/sessions/:id` post-finish

### Phase 4: Frontend — analysis panel + session detail

- `AnalysisPanel` component (spinner / `react-markdown` / retry button)
- Add to `SessionDetailPage` below exercises list
- `SessionDetailPage` fetches analysis on mount for `completed` sessions

### Phase 5: Frontend — history page

- `HistoryPage` at `/history`
- `App.tsx`: add `/history` route
- `NavBar`: add "Historique" link

## Design Mobilization

- **Tokens used**: `ink`, `canvas`, `soft-cloud`, `mute`, `hairline`, `success` (done chip), `sale` (failed chip)
- **Components used**: `button-primary` (Réessayer CTA), `button-secondary` (dismiss), `filter-chip` / `filter-chip-active` (status chip on history rows)
- **Surfaces touched**: SessionDetailPage, HistoryPage, NavBar, fixed-top banner
- **States covered**:
  - Loading: spinner on `SessionDetailPage` analysis panel while `pending`
  - Empty: "Aucune séance complétée" on HistoryPage
  - Error: "Analyse indisponible" + retry on banner and panel; "Impossible de charger l'historique" on HistoryPage
  - Success: Markdown-rendered analysis in panel, "Analyse prête" banner
  - Timeout (>90s): "L'analyse prend plus de temps que prévu. Réessayez plus tard."
- **A11y notes**: Banner must be `role="status"` or `role="alert"` depending on urgency; dismiss button needs `aria-label="Fermer"`

## Test Strategy

- **Mocking approach**: Vitest + React Testing Library for hooks and components; `vi.useFakeTimers()` for `useAnalysisPoller` interval/timeout; mock `analysis-client.ts` via `vi.mock`
- **Happy paths**: poller resolves to `done` → banner appears; history page renders rows; SessionDetailPage shows Markdown
- **Error scenarios**: poller hits `failed` → retry button; network error on retry → toast; 90s timeout → check-later state
- **Edge cases**: poller with null `sessionId` (no-op); history page with 0 completed sessions; analysis not yet triggered (no record, 404 → panel hidden)

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**:
  - `react-markdown` peer dep conflicts with React 19 — verify before installing
  - History N+1 in backend: `findBySession` called once per completed session; acceptable for single user, but could be slow with many sessions. Monitor; optimize with single query if needed.
- **New dependencies**: `react-markdown` (frontend)
