# Tasks: Notifications & Progress History

**Plan**: specs/010-notifications-progress/plan.md
**Status**: Ready
**Total**: 17 tasks across 5 phases

## Phase 1: Backend — history endpoint

- [x] **T-1.1**: Add `HistoryEntry` read model and `GetHistoryUseCase`
  - **Do**: Create `backend/src/application/analysis/get-history.use-case.ts`. Define inline type `HistoryEntry { session: Session; volumeKg: number; analysisStatus: AnalysisStatus | null }`. Use case fetches completed sessions via `sessionRepository.findByUser(userId, 'all')`, filters `status === 'completed'`, then for each calls `workoutLogRepository.findBySession(s.id)` and computes `volumeKg = sum(log.repsCompleted * log.weightKg)` (skip if either null, fallback to `log.repsCompleted ?? 0` as set-count proxy). Fetch `analysisRepository.findBySessionId(s.id)` for `analysisStatus`. Return sorted reverse-chronological (by `plannedDate` desc).
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-history"`

- [x] **T-1.2**: Spec `get-history.use-case.spec.ts`
  - **Do**: Create `backend/src/application/analysis/get-history.use-case.spec.ts`. Mock `SessionRepository.findByUser`, `WorkoutLogRepository.findBySession`, `SessionAnalysisRepository.findBySessionId`. Test: (1) returns only completed sessions, (2) volume = sum of reps×weight skipping nulls, (3) `analysisStatus` null when no analysis record, (4) sorted newest first.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-history"`

- [x] **T-1.3**: Expose `GET /api/history` in `AnalysisController` + register use case in module
  - **Do**: In `backend/src/interfaces/http/controllers/analysis.controller.ts` add `@Get('history') async getHistory(@CurrentUser() user)`. In `backend/src/analysis/analysis.module.ts` add `GetHistoryUseCase` to providers. Import use case in controller.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="analysis.controller"` (add test for GET /history returning 200 with mocked use case)

## Phase 2: Frontend infrastructure

- [x] **T-2.1**: Create `analysis-client.ts`
  - **Do**: Create `frontend/src/infrastructure/analysis-client.ts`. Define types `AnalysisStatus = 'pending' | 'done' | 'failed'`, `SessionAnalysis { id: string; sessionId: string; status: AnalysisStatus; result: string | null }`, `HistoryEntry { session: Session; volumeKg: number; analysisStatus: AnalysisStatus | null }`. Implement `request<T>()` helper (fetch with credentials, non-ok throws). Export `getAnalysis(sessionId: string): Promise<SessionAnalysis | null>` (404 → null), `retryAnalysis(sessionId: string): Promise<void>`, `getHistory(): Promise<HistoryEntry[]>`.
  - **Test**: Manual type-check: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-2.2**: Create `useAnalysisPoller` hook
  - **Do**: Create `frontend/src/presentation/shared/useAnalysisPoller.ts`. Signature: `useAnalysisPoller(sessionId: string | null): { status: AnalysisStatus | 'timeout' | null; result: string | null; retry: () => void }`. Implementation: `setInterval` at 5000ms when `sessionId != null`, clears on `done`/`failed`/unmount. After 90s (18 ticks) without terminal status, sets `status: 'timeout'`. `retry()` calls `retryAnalysis(sessionId)` then resets interval and `status` to `null`. Use `useRef` for interval and tick counter.
  - **Test**: `npm run test --workspace=frontend -- --testPathPattern="useAnalysisPoller"` (create spec — see T-2.3)

- [x] **T-2.3**: Spec `useAnalysisPoller.spec.ts`
  - **Do**: Create `frontend/src/presentation/shared/useAnalysisPoller.spec.ts`. Use `vi.useFakeTimers()` and `vi.mock('../../infrastructure/analysis-client')`. Test: (1) does nothing when `sessionId` null, (2) polls every 5s, resolves `done` → status updated, (3) after 90s without terminal status → `timeout`, (4) `retry()` resets state and resumes polling.
  - **Test**: `npm run test --workspace=frontend -- --testPathPattern="useAnalysisPoller"`

## Phase 3: Banner + context + ExecutionPage wiring

- [x] **T-3.1**: Create `AnalysisContext`
  - **Do**: Create `frontend/src/presentation/shared/AnalysisContext.tsx`. Export `AnalysisContext = createContext<{ pendingSessionId: string | null; setPending: (id: string | null) => void }>`. Export `AnalysisProvider` component that wraps children with the context using `useState`.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-3.2**: Create `AnalysisBanner` component
  - **Do**: Create `frontend/src/presentation/shared/AnalysisBanner.tsx`. Reads `pendingSessionId` from `AnalysisContext`, calls `useAnalysisPoller(pendingSessionId)`. Renders a fixed top banner (`fixed top-0 left-0 right-0 z-50 ...`) only when `pendingSessionId != null`. States: `null`/polling → nothing; `done` → "Analyse prête — Voir les résultats" with link to `/sessions/:id` + dismiss button (sets `setPending(null)`); `failed` → "Analyse indisponible" + "Réessayer" button + dismiss; `timeout` → "L'analyse prend plus de temps que prévu. Réessayez plus tard." + dismiss. Use tokens: `bg-canvas border-b border-hairline`, button-primary for CTA (`bg-ink text-canvas rounded-full`), dismiss `aria-label="Fermer"`. Banner is `role="status"`.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-3.3**: Wire `AnalysisContext` + `AnalysisBanner` into `App.tsx`
  - **Do**: In `frontend/src/App.tsx`, wrap the top-level `<Routes>` with `<AnalysisProvider>`. Inside `RequireAuth` wrapper (above inner `<Routes>`), add `<AnalysisBanner />` alongside `<NavBar />`.
  - **Test**: `npm run lint` — no ESLint errors

- [x] **T-3.4**: `ExecutionPage` — set pending context + navigate to session after finish
  - **Do**: In `frontend/src/presentation/execution/ExecutionPage.tsx`, import `useContext(AnalysisContext)`. In `handleFinish`, after `await finishSession(id, rpe, note)`, call `setPending(id)` then `navigate(\`/sessions/${id}\`)`(replacing`navigate('/')`).
  - **Test**: `npm run test --workspace=frontend -- --testPathPattern="ExecutionPage"` — existing tests pass

## Phase 4: Analysis panel + SessionDetailPage

- [x] **T-4.1**: Create `AnalysisPanel` component
  - **Do**: Create `frontend/src/presentation/shared/AnalysisPanel.tsx`. Props: `sessionId: string`. Fetches analysis on mount via `getAnalysis(sessionId)`. Then uses `useAnalysisPoller(sessionId)` only if fetched status is `pending` (otherwise shows static result). States: no record (null from 404) → render nothing; `pending` → spinner + "Analyse en cours…"; `done` → `<ReactMarkdown>` with `result`; `failed` → "Analyse indisponible" + "Réessayer" `button-primary` which calls `retryAnalysis` then re-fetches. Tokens: `text-ink`, `text-mute`, `bg-soft-cloud rounded-lg p-4`. Import `react-markdown` (after adding dep).
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-4.2**: Install `react-markdown` and verify React 19 compat
  - **Do**: In `frontend/`, run `npm install react-markdown`. Verify no peer dep conflicts in output. Add to `frontend/package.json`.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — no type errors

- [x] **T-4.3**: Add `AnalysisPanel` to `SessionDetailPage`
  - **Do**: In `frontend/src/presentation/planning/SessionDetailPage.tsx`, import `AnalysisPanel`. Below the exercises list (and below action buttons), render `{session.status === 'completed' && id && <AnalysisPanel sessionId={id} />}`. No other changes.
  - **Test**: `npm run lint` — no errors; `npx tsc --noEmit --project frontend/tsconfig.app.json`

## Phase 5: History page + navigation

- [x] **T-5.1**: Create `HistoryPage` component
  - **Do**: Create `frontend/src/presentation/planning/HistoryPage.tsx`. On mount, calls `getHistory()`. States: loading → spinner; error → "Impossible de charger l'historique"; empty → "Aucune séance complétée pour l'instant"; list → reverse-chronological rows. Each row: `<Link to={\`/sessions/${entry.session.id}\`}>` containing date (`new Date(entry.session.plannedDate + 'T00:00:00')` formatted `dd MMM yyyy` via `Intl.DateTimeFormat('fr-FR')`), exercises (comma-separated `exerciseName`), volume (`${entry.volumeKg.toFixed(1)} kg` or "—" if 0), analysis status chip (`done`→ green pill,`failed`→ red pill,`pending`→ gray pill, null → nothing). Tokens:`bg-soft-cloud`, `text-ink`, `text-mute`, status chips use `success`/`sale`/`hairline` border colors.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-5.2**: Register `/history` route in `App.tsx`
  - **Do**: In `frontend/src/App.tsx`, add `import { HistoryPage }` and `<Route path="history" element={<HistoryPage />} />` inside the authenticated inner `<Routes>`.
  - **Test**: `npm run lint`

- [x] **T-5.3**: Add "Historique" link to `NavBar`
  - **Do**: In `frontend/src/presentation/shared/NavBar.tsx`, add `{ to: '/history', label: 'Historique', end: false }` to `LINKS` array.
  - **Test**: `npm run lint`

## Phase 6: Quality gates

- [x] **T-6.1**: Full test suite + lint + type check
  - **Do**: Run `npm run test`, `npm run lint`, `npx tsc --noEmit --project backend/tsconfig.build.json`, `npx tsc --noEmit --project frontend/tsconfig.app.json`. Fix any failures.
  - **Test**: All commands exit 0
