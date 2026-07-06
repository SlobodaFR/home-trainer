# Tasks: Session Execution — UI

**Plan**: specs/008-session-execution-ui/plan.md
**Status**: Ready
**Total**: 14 tasks across 4 phases

## Phase 1: Types + client layer

- [x] **T-1.1**: Extend `Session` type in `planning-client.ts`
  - **Do**: In `frontend/src/infrastructure/planning-client.ts`:
    - Add `'paused'` to `Session.status` union: `'planned' | 'active' | 'paused' | 'completed'`
    - Add `rpe: number | null` and `note: string | null` fields to `Session` interface
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — 0 errors

- [x] **T-1.2**: Create `execution-client.ts`
  - **Do**: Create `frontend/src/infrastructure/execution-client.ts`:
    - `WorkoutLog` interface: `{ id, sessionId, sessionExerciseId, userId, setNumber, repsCompleted: number | null, weightKg: number | null, durationSeconds: number | null, completedAt: string }`
    - `LogSetInput` interface: `{ sessionExerciseId, setNumber, repsCompleted?: number, weightKg?: number, durationSeconds?: number }`
    - Private `request<T>(url, init?)` helper (same pattern as `planning-client.ts`: `credentials: 'include'`, throw on non-ok)
    - Export: `startSession(id)`, `pauseSession(id)`, `resumeSession(id)`, `finishSession(id, rpe, note)`, `logSet(sessionId, input)`, `getSets(sessionId)`
    - `finishSession` body: `{ rpe: rpe ?? undefined, note: note ?? undefined }` — omit nulls so class-validator Optional fields aren't sent as null
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — 0 errors

## Phase 2: Core hooks + isolated components

- [x] **T-2.1**: Create `useRestTimer.ts` hook
  - **Do**: Create `frontend/src/presentation/execution/useRestTimer.ts`:
    - State: `remaining: number` (starts at 90), `active: boolean`
    - `start()`: sets `active = true`, `remaining = 90`; ticks down via `setInterval(1000)`; on `remaining === 0` calls `playBeep()` and sets `active = false`; clears interval on dismount
    - `dismiss()`: clears interval, sets `active = false`
    - `playBeep()`: lazy-init `AudioContext` in a `useRef`; call `ctx.resume()` (iOS guard); create `OscillatorNode` (440 Hz, sine), `GainNode` (ramp from 0.3 to 0 over 0.2s); start + stop at `ctx.currentTime + 0.2`
    - Returns `{ remaining, active, start, dismiss }`
  - **Test**: `npm run test --workspace=frontend -- useRestTimer` — hook starts at 90, decrements with fake timers, `active` flips false at 0

- [x] **T-2.2**: Create `RPEModal.tsx`
  - **Do**: Create `frontend/src/presentation/execution/RPEModal.tsx`:
    - Props: `onFinish(rpe: number | null, note: string | null): void`, `onCancel(): void`, `loading: boolean`
    - RPE: row of 10 `filter-chip` / `filter-chip-active` buttons (1–10); nullable selection
    - Note: `<textarea>` max 1000 chars, `rows=3`, `placeholder="Note optionnelle…"`, `border border-hairline rounded p-2 text-sm w-full`
    - CTA: `button-primary` "Terminer la séance" (disabled while loading), `button-secondary` "Annuler" calls `onCancel`
    - Overlay: `fixed inset-0 bg-ink/40 flex items-end z-50` → inner panel `bg-canvas rounded-t-2xl p-6 flex flex-col gap-4`
    - Focus: `autoFocus` on first RPE chip on mount
  - **Test**: `npm run test --workspace=frontend -- RPEModal` — renders RPE chips 1–10; clicking chip selects it; Annuler calls onCancel; submit calls onFinish with selected rpe+note

- [x] **T-2.3**: Create `ExerciseSetCard.tsx`
  - **Do**: Create `frontend/src/presentation/execution/ExerciseSetCard.tsx`:
    - Props: `exercise: SessionExercise`, `logs: WorkoutLog[]`, `onLogSet(input: LogSetInput): void`, `submitting: boolean`
    - Header: exercise name (`font-medium text-ink`) + target (`text-mute text-sm`) + set badge `{logs.length}/{exercise.sets}`
    - Logged sets list: for each log show `Set {n}: {reps}r · {weight}kg · {duration}s` (show only non-null fields); use `caption-md mute`
    - Form: three optional number inputs (reps, weight kg, duration s) using `<input type="number" min="0">` styled as `border border-hairline rounded px-3 py-1.5 text-sm w-20`; setNumber auto-derived as `logs.length + 1`; "Enregistrer" `button-primary` pill disabled while submitting
    - Wrap card in `bg-canvas rounded p-4 flex flex-col gap-3`
  - **Test**: `npm run test --workspace=frontend -- ExerciseSetCard` — renders target, renders logged sets, submit calls onLogSet with correct input

## Phase 3: ExecutionPage + wiring

- [x] **T-3.1**: Create `ExecutionPage.tsx` skeleton (load + render)
  - **Do**: Create `frontend/src/presentation/execution/ExecutionPage.tsx`:
    - On mount: `Promise.all([getSession(id), getSets(id)])` — loading spinner while pending; on 404 `navigate('/')` with toast; on success set `session` + group `logs` by `sessionExerciseId` into `Record<string, WorkoutLog[]>`
    - Render: full-screen `bg-soft-cloud`, back button "← Quitter" (`navigate(-1)`), session date heading, sorted exercise list using `ExerciseSetCard` (read-only `onLogSet` placeholder, no submitting)
    - No NavBar (this route will live outside the NavBar wrapper)
    - Import `useToast` + `Toast`
  - **Test**: `npm run test --workspace=frontend -- ExecutionPage` — shows spinner on load; renders exercises after resolve; navigates on 404

- [x] **T-3.2**: Add optimistic set logging to `ExecutionPage`
  - **Do**: In `ExecutionPage.tsx`:
    - State: `logs: Record<string, WorkoutLog[]>` (initialized from getSets response)
    - `handleLogSet(exerciseId, input)`: build optimistic entry `{ id: 'opt-' + String(Date.now()), sessionId: id, sessionExerciseId: input.sessionExerciseId, userId: session.userId, setNumber: input.setNumber, repsCompleted: input.repsCompleted ?? null, weightKg: input.weightKg ?? null, durationSeconds: input.durationSeconds ?? null, completedAt: new Date().toISOString() }`; append to `logs[exerciseId]`; call `logSet(id, input)`; on success replace optimistic entry (match by `sessionExerciseId + setNumber`); on failure remove it and `showToast('Set non enregistré — réessayez.')`
    - Track `submitting: Record<string, boolean>` per exerciseId
    - Pass `onLogSet`, `submitting[ex.id]` to each `ExerciseSetCard`
  - **Test**: `npm run test --workspace=frontend -- ExecutionPage` — optimistic entry appears; on API reject entry removed and toast shown

- [x] **T-3.3**: Add Pause/Resume/Finish controls to `ExecutionPage`
  - **Do**: In `ExecutionPage.tsx`:
    - Session status state: `sessionStatus: Session['status']` (initialized from loaded session)
    - Controls bar (sticky bottom): Pause/Resume toggle + Finish button
    - Pause: calls `pauseSession(id)`, on success `setSessionStatus('paused')`; on error toast
    - Resume: calls `resumeSession(id)`, on success `setSessionStatus('active')`; on error toast
    - Show Pause when `sessionStatus === 'active'`, Resume when `'paused'`
    - Finish button always visible → sets `showFinish = true`
    - `transitioning: boolean` state disables controls during API calls
  - **Test**: `npm run test --workspace=frontend -- ExecutionPage` — Pause calls pauseSession, status switches; Resume calls resumeSession, status switches

- [x] **T-3.4**: Integrate `useRestTimer` into `ExecutionPage`
  - **Do**: In `ExecutionPage.tsx`:
    - Call `const timer = useRestTimer()` at top
    - After each successful `logSet` API response: call `timer.start()`
    - Render timer UI below controls bar (only when `timer.active`): countdown `{timer.remaining}s` in `text-2xl font-medium text-ink text-center`; dismiss button "Passer" `button-secondary` pill calling `timer.dismiss()`
  - **Test**: `npm run test --workspace=frontend -- ExecutionPage` — after set logged, timer shows; dismiss hides it

- [x] **T-3.5**: Add RPE modal + finish flow to `ExecutionPage`
  - **Do**: In `ExecutionPage.tsx`:
    - State: `showFinish: boolean`, `finishing: boolean`
    - Render `<RPEModal>` conditionally when `showFinish`
    - `handleFinish(rpe, note)`: sets `finishing = true`; calls `finishSession(id, rpe, note)`; on success navigate to `/`; on error `showToast('Erreur — réessayez.')`, reset `finishing`
    - `onCancel`: sets `showFinish = false`
  - **Test**: `npm run test --workspace=frontend -- ExecutionPage` — Finish button opens modal; cancel closes it; submit calls finishSession + navigates

- [x] **T-3.6**: Add `ExecutionPage` route to `App.tsx`
  - **Do**: In `frontend/src/App.tsx`:
    - Import `ExecutionPage` from `./presentation/execution/ExecutionPage`
    - Add `<Route path="sessions/:id/execute" element={<ExecutionPage />} />` as a sibling route **outside** the `<RequireAuth>` / NavBar wrapper — but still under auth. The `RequireAuth` wrapper currently wraps `/*`; add a separate protected route for `sessions/:id/execute` at the same level, OR move it inside `RequireAuth` but outside the NavBar render. Best: add `<Route path="sessions/:id/execute" element={<RequireAuth><ExecutionPage /></RequireAuth>} />` before the catch-all `/*` route.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json` — 0 errors; `npm run lint` from root — 0 warnings

- [x] **T-3.7**: Add "Commencer" CTA to `SessionDetailPage`
  - **Do**: In `frontend/src/presentation/planning/SessionDetailPage.tsx`:
    - Import `startSession` from `../../infrastructure/execution-client`
    - State: `starting: boolean`
    - `handleStart()`: sets `starting = true`; calls `startSession(id)`; on success `navigate('/sessions/${id}/execute')`; on error `showToast('Impossible de démarrer la séance')`, reset `starting`
    - Replace existing `status === 'planned'` block: keep "Replanifier" button, add "Commencer" `button-primary` pill next to it (or stacked); "Commencer" shown when `status === 'planned'`, disabled while `starting`
    - Also show "Reprendre" `button-secondary` pill when `status === 'active' || status === 'paused'` → `navigate('/sessions/${id}/execute')`
  - **Test**: `npm run test --workspace=frontend -- SessionDetailPage` — "Commencer" visible for planned; calls startSession; navigates on success; toast on error

## Phase 4: Tests

- [x] **T-4.1**: `execution-client.spec.ts` unit tests
  - **Do**: Create `frontend/src/infrastructure/execution-client.spec.ts`:
    - Mock `fetch` with `vi.stubGlobal('fetch', vi.fn())`
    - `startSession`: asserts `POST /api/sessions/s1/start` called with `credentials: 'include'`; returns parsed JSON
    - `logSet`: asserts correct body serialization (`sessionExerciseId`, `setNumber`, optional fields)
    - `getSets`: asserts `GET /api/sessions/s1/sets`; returns array
    - Error case: non-ok response → throws `Error('404: ...')`
  - **Test**: `npm run test --workspace=frontend -- execution-client`

- [x] **T-4.2**: `useRestTimer.spec.ts` unit tests
  - **Do**: Create `frontend/src/presentation/execution/useRestTimer.spec.ts`:
    - Mock `AudioContext`: `vi.stubGlobal('AudioContext', vi.fn(() => ({ createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } })), createGain: vi.fn(() => ({ connect: vi.fn(), gain: { linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() } })), currentTime: 0, resume: vi.fn().mockResolvedValue(undefined), destination: {} })))`
    - `vi.useFakeTimers()` in `beforeEach`
    - Test: `start()` → `active = true`, `remaining = 90`
    - Test: after `vi.advanceTimersByTime(90_000)` → `active = false`, `remaining = 0`
    - Test: `dismiss()` mid-countdown → `active = false`, interval cleared
  - **Test**: `npm run test --workspace=frontend -- useRestTimer`

- [x] **T-4.3**: `ExecutionPage.spec.tsx` integration tests
  - **Do**: Create `frontend/src/presentation/execution/ExecutionPage.spec.tsx`:
    - `vi.mock('../../../infrastructure/execution-client')` + `vi.mock('../../../infrastructure/planning-client')` for `getSession`
    - Provide `MemoryRouter` wrapper
    - Test: renders exercise names after data loads
    - Test: submitting set form calls `logSet`; optimistic entry appears
    - Test: `logSet` rejects → entry removed → toast text contains "Set non enregistré"
    - Test: Pause button click → calls `pauseSession`; Resume button appears
    - Test: Finish button → modal opens; Annuler closes it; submit calls `finishSession`
  - **Test**: `npm run test --workspace=frontend -- ExecutionPage`
