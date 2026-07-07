# Review: Notifications & Progress History

**Date**: 2026-07-07
**Reviewer**: Claude Code (automated)

## Task Completion

- Total: 17 | Completed: 17 | Blocked: 0

## Acceptance Criteria

| #     | Criterion                                                                                      | Status | Notes                                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | After finishing a session, UI polls `GET /analyses/:sessionId` every 5s                        | PASS   | `ExecutionPage.handleFinish` calls `setPending(id)` then navigates to `/sessions/:id`; `AnalysisBanner` picks up context and runs `useAnalysisPoller(pendingSessionId)` at 5s interval |
| AC-2  | When analysis status becomes `done`, dismissible banner appears                                | PASS   | `AnalysisBanner` renders "Analyse prête — Voir les résultats" banner with dismiss ✕ button                                                                                             |
| AC-3  | Clicking banner navigates to `SessionDetailPage` showing Markdown analysis                     | PASS   | `<Link to={\`/sessions/${pendingSessionId}\`}>`in banner;`SessionDetailPage`renders`<AnalysisPanel>`which uses`react-markdown`for`done` state                                          |
| AC-4  | Failed status shows "Réessayer"; clicking calls retry and resumes polling                      | PASS   | Banner `failed` branch calls `retry()` from `useAnalysisPoller`; `retry()` calls `retryAnalysis()` then `startPolling()`                                                               |
| AC-5  | Polling stops after 90s; shows "check later" message                                           | PASS   | `useAnalysisPoller` sets `status: 'timeout'` after 18 ticks (90s); banner and panel both render timeout message; 5 spec tests cover this                                               |
| AC-6  | `SessionDetailPage` shows analysis panel (spinner / text / error+retry)                        | PASS   | `{session.status === 'completed' && id && <AnalysisPanel sessionId={id} />}` renders below exercises list; 3 states covered                                                            |
| AC-7  | `/history` lists completed sessions reverse-chron with date, exercises, volume, analysisStatus | PASS   | `HistoryPage` fetches `GET /api/history`, sorts by `plannedDate` desc in backend, renders date + exercise names + volume + status chip                                                 |
| AC-8  | Clicking a history row navigates to `SessionDetailPage`                                        | PASS   | Each row is `<Link to={\`/sessions/${entry.session.id}\`}>`                                                                                                                            |
| AC-9  | NavBar shows "Historique" link to `/history`                                                   | PASS   | `LINKS` array in `NavBar.tsx` has `{ to: '/history', label: 'Historique', end: false }`                                                                                                |
| AC-10 | Analysis panel uses design tokens only — no raw hex values                                     | PASS   | All classNames use `ink`, `canvas`, `soft-cloud`, `mute`, `hairline`, `success`, `sale` tokens. `shadow-sm` is an existing convention (also in `Toast.tsx`)                            |

## Architecture Compliance

| Decision                                                         | Followed? | Notes                                                                                                |
| ---------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| AD-1: `GetHistoryUseCase` in `AnalysisModule`                    | PASS      | Added to `analysis.module.ts` providers; all repos already available                                 |
| AD-2: `AnalysisContext` at `App.tsx` level                       | PASS      | `<AnalysisProvider>` wraps top-level `<Routes>`; `AnalysisBanner` inside `RequireAuth` wrapper       |
| AD-3: `useAnalysisPoller` hook (5s interval, 90s timeout, retry) | PASS      | `setInterval` 5000ms, `MAX_TICKS = 18`, `activeRef` guard prevents stale async updates; 5 spec tests |
| AD-4: Volume computed in backend `GetHistoryUseCase`             | PASS      | `sum(reps × weight)` with fallback to `repsCompleted` when weight null                               |
| AD-5: `react-markdown`                                           | PASS      | Installed, used in `AnalysisPanel` for `done` state                                                  |
| AD-6: `ExecutionPage` navigates to `/sessions/:id` after finish  | PASS      | `navigate(\`/sessions/${id}\`)`replaces`navigate('/')`                                               |

## Quality Gates

| Check          | Status | Details                                                                                                   |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Backend tests  | PASS   | 30 suites, 143 tests                                                                                      |
| Frontend tests | PASS   | 4 suites, 21 tests                                                                                        |
| Lint           | PASS   | 0 errors, 2 pre-existing warnings (`react-refresh` in context files — same pattern as `AuthProvider.tsx`) |
| TSC backend    | PASS   | `tsc --noEmit` zero output                                                                                |
| TSC frontend   | PASS   | `tsc --noEmit` zero output                                                                                |

## Spec Compliance

| Check                         | Status | Notes                                                                                                                                                                                                                      |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error handling                | PASS   | Polling timeout → "check later"; retry network failure handled in `AnalysisPanel` (catch on `retryAnalysis`); history load failure → empty state                                                                           |
| Codebase patterns             | PASS   | 5-layer clean arch on backend; optional-chain auth (not needed here — history is user-owned by query); `void` fire-and-forget; sibling imports before parents                                                              |
| Design tokens applied         | PASS   | All new components use design token names only; `shadow-sm` consistent with `Toast.tsx` existing pattern                                                                                                                   |
| Component inventory respected | PASS   | `AnalysisBanner`, `AnalysisPanel`, `SessionHistoryRow` (inline in `HistoryPage`) are new; not in DESIGN.md inventory — acceptable, DESIGN.md is a Nike reference system, not prescriptive component registry               |
| State coverage                | PASS   | Loading: spinners on HistoryPage + AnalysisPanel; Empty: "Aucune séance complétée"; Error: history load fail + analysis retry; Success: Markdown rendered + banner "prête"; Timeout (no-network analog): 90s timeout state |
| A11y baseline                 | PASS   | Banner has `role="status"`, dismiss buttons have `aria-label="Fermer"`; interactive rows are `<Link>` (keyboard-accessible); `<button type="button">` for all CTAs                                                         |

## Constitution Compliance

No constitution — run `/constitution` to create one.

## Issues Found

| Severity | Description                                                                                                                                                                                                                          | Fix                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| INFO     | `AnalysisPanel` shows initial fetch result but also starts poller if `initialStatus === 'pending'` — if user opens `SessionDetailPage` after analysis completes, the panel shows static result (no poller running). This is correct. | No action needed                                                                |
| INFO     | `ExecutionPage.spec.tsx` emits "No routes matched location `/sessions/s1`" warning — the navigation change is intentional and test still passes.                                                                                     | Acceptable; fix later by adding `/sessions/:id` route in test wrapper if needed |

## Verdict

**Ready to merge**
