# Plan: Session Execution — UI

**Spec**: specs/008-session-execution-ui/spec.md

## Architecture Decisions

### AD-1: New `execution-client.ts` (not extending `planning-client.ts`)

- **Choice**: Create `frontend/src/infrastructure/execution-client.ts` for `WorkoutLog` type + all 6 execution API functions. Extend `planning-client.ts` only for type changes (`Session.status` + `rpe`/`note` fields).
- **Rationale**: Mirrors the existing client pattern (`api-client.ts`, `exercise-client.ts`, `planning-client.ts`). Execution is a distinct domain; co-locating 6 new functions in planning-client bloats it.
- **Alternatives considered**: Extend planning-client directly — simpler import tree but mixes planning and execution concerns.

### AD-2: New route `/sessions/:id/execute` → `ExecutionPage`

- **Choice**: Separate page component at a dedicated route. `SessionDetailPage` gains a "Commencer" CTA that navigates there. `ExecutionPage` is full-screen, no NavBar.
- **Rationale**: Execution is a distinct UX mode (full attention, timer, form). Embedding it in `SessionDetailPage` via conditional state would create conditional rendering chaos. Navigating away to a clean page is intentional.
- **Alternatives considered**: In-place mode toggle on `SessionDetailPage` — harder to reason about, NavBar stays visible (distraction during training).

### AD-3: `useRestTimer` custom hook — `setInterval` + `useRef` for AudioContext

- **Choice**: Encapsulate timer state (`remaining`, `running`) and Web Audio API in a custom hook. `AudioContext` persisted in a `useRef` to survive re-renders without recreation.
- **Rationale**: Timer logic interleaved with set-logging state is messy. Isolated hook is testable and reusable.
- **Alternatives considered**: Inline `useEffect` in `ExecutionPage` — works but couples unrelated state.

### AD-4: Web Audio API beep — no audio file

- **Choice**: `AudioContext.createOscillator()` → 440 Hz, 200ms, ramp-down gain. `AudioContext` created lazily on first user interaction (browser policy) via a `useRef`.
- **Rationale**: No external file dependency. Works offline. Matches PRD "visual + audio alert on timer end".
- **Alternatives considered**: `<audio>` tag with base64 MP3 — adds weight, still needs user gesture, no gain over oscillator.

### AD-5: Optimistic set logging with index-keyed rollback

- **Choice**: On submit, append `{ ...optimisticEntry, id: 'opt-' + Date.now() }` to local state. On API success, replace the optimistic entry by matching `sessionExerciseId + setNumber`. On failure, filter it out and call `showToast('Set non enregistré — réessayez.')`.
- **Rationale**: PRD requires optimistic UI + toast on failure. Matching by `sessionExerciseId + setNumber` is stable since sets are unique per exercise per number.
- **Alternatives considered**: Separate optimistic/confirmed arrays — more complex, not needed for single-user app.

### AD-6: RPE modal — inline `fixed` overlay, no React portal

- **Choice**: Render `RPEModal` conditionally inside `ExecutionPage` JSX as a `fixed inset-0` overlay. No `ReactDOM.createPortal`.
- **Rationale**: Single-level overlay; no nested stacking contexts that would cause clipping. `z-50` is sufficient.
- **Alternatives considered**: `createPortal` — only warranted if parent has `transform` or `overflow: hidden`, which this layout doesn't.

### AD-7: No NavBar on `ExecutionPage`

- **Choice**: `ExecutionPage` rendered outside the `<NavBar />` wrapper in `App.tsx`, as a sibling route at the top level.
- **Rationale**: Execution is full-screen and interruptive. NavBar is distracting during a workout. Back navigation is handled by an explicit "← Quitter" button that calls `navigate(-1)` (with confirmation if session is active).
- **Alternatives considered**: Keep NavBar — clutters execution UX.

## Affected Files

### New Files

| File                                                      | Purpose                                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `frontend/src/infrastructure/execution-client.ts`         | `WorkoutLog` type + `startSession`, `pauseSession`, `resumeSession`, `finishSession`, `logSet`, `getSets` |
| `frontend/src/presentation/execution/ExecutionPage.tsx`   | Full execution UI: exercise list, controls, timer, RPE modal                                              |
| `frontend/src/presentation/execution/useRestTimer.ts`     | Timer hook: countdown state, Web Audio beep, start/dismiss controls                                       |
| `frontend/src/presentation/execution/ExerciseSetCard.tsx` | Per-exercise card: set history + inline log form                                                          |
| `frontend/src/presentation/execution/RPEModal.tsx`        | Finish modal: RPE 1–10 + optional note + CTA                                                              |

### Modified Files

| File                                                       | Change                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `frontend/src/infrastructure/planning-client.ts`           | Add `'paused'` to `Session.status`; add `rpe: number \| null`, `note: string \| null` to `Session` |
| `frontend/src/presentation/planning/SessionDetailPage.tsx` | Add "Commencer" CTA (status === 'planned') → `POST /start` → navigate to `/sessions/:id/execute`   |
| `frontend/src/App.tsx`                                     | Add route `/sessions/:id/execute` → `ExecutionPage` (outside NavBar wrapper)                       |

## Implementation Phases

### Phase 1: Types + client layer

- Extend `Session` type in `planning-client.ts` (`'paused'` status, `rpe`, `note`)
- Create `execution-client.ts` with `WorkoutLog` interface + all 6 API functions

### Phase 2: Core hooks + isolated components

- `useRestTimer.ts` — countdown (90s), auto-start on `start()` call, `dismiss()`, beep on end via Web Audio API
- `RPEModal.tsx` — RPE 1–10 slider (or Stepper), optional textarea note, "Terminer la séance" CTA, "Annuler" secondary
- `ExerciseSetCard.tsx` — exercise header (name, target sets × repsOrDuration), logged sets list (reps / weight / duration), inline form (reps / weight / duration number inputs + "Enregistrer" button)

### Phase 3: ExecutionPage + wiring

- `ExecutionPage.tsx`:
  - On mount: `getSession(id)` + `getSets(id)` in parallel; redirect to `/` on 404
  - Controls: Pause/Resume toggle, Finish button
  - Optimistic set log: append before API, replace on success, rollback on failure
  - Render `useRestTimer` output below each `ExerciseSetCard`; timer auto-starts after any set logged
  - Render `RPEModal` when `showFinish` state true
- `App.tsx` route addition: `/sessions/:id/execute` as sibling of NavBar-wrapped routes
- `SessionDetailPage.tsx`: "Commencer" button (planned only) → `startSession(id)` → `navigate('/sessions/${id}/execute')`

### Phase 4: Tests

- `execution-client.spec.ts` — unit tests for `startSession`, `logSet`, `getSets` (mock `fetch`)
- `useRestTimer.spec.ts` — unit tests via `renderHook`: starts at 90, decrements, calls `onEnd`, dismisses
- `ExecutionPage.spec.tsx` — integration tests: renders exercises, submits set, optimistic rollback on failure, Pause/Resume state transitions, Finish modal flow

## Design Mobilization

- **Tokens used**: `ink`, `canvas`, `soft-cloud`, `mute`, `hairline`, `success` (timer completion ring)
- **Components used**: `button-primary`, `button-secondary`, `button-icon-circular`, `filter-chip` / `filter-chip-active` (RPE scale), `heading-xl`, `heading-md`, `body-md`, `caption-md`
- **New components** (new to inventory, use existing tokens only): `ExerciseSetCard`, `RestTimer` (progress ring + countdown), `RPEModal`, no new tokens required
- **Surfaces touched**: `ExecutionPage` (new, full-screen), `SessionDetailPage` (existing, start CTA added)
- **States covered**:
  - Loading: spinner while `getSession` / `getSets` resolve on mount
  - Empty: exercise list renders "Aucun exercice" if empty
  - Error: 404 on mount → redirect `/` with toast; API transition errors → toast
  - Success: set logged → optimistic entry in list; timer starts; finish → navigate to `/`
  - Offline/failure: set log failure → optimistic rollback + toast
- **A11y notes**: RPE modal traps focus (focus first focusable element on open, restore on close). Timer progress ring uses `aria-label="Temps de repos restant: Xs"`. All interactive controls have explicit `aria-label`.

## Test Strategy

- **Mocking approach**: Vitest `vi.mock('../../../infrastructure/execution-client')` for API calls. Timer: `vi.useFakeTimers()` in `useRestTimer` tests to control `setInterval`. Web Audio API: mock `AudioContext` via `vi.stubGlobal('AudioContext', ...)`.
- **Happy paths**:
  - `ExecutionPage` loads → exercises render → set form submit → optimistic entry appears
  - Pause → button switches to Resume; Resume → switches back
  - Finish modal opens → RPE selected → submit → navigate called
  - Timer auto-starts after set logged; beep called at 0s
- **Error scenarios**:
  - `logSet` rejects → optimistic entry removed → toast shown
  - `startSession` rejects in `SessionDetailPage` → toast, no navigation
  - `getSession` returns 404 on ExecutionPage mount → navigate to `/`
- **Edge cases**:
  - Timer dismissed before reaching 0 → no beep, no state side-effect
  - RPE modal dismissed → session stays active, no API call

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**:
  - Web Audio API requires user gesture to initialize `AudioContext` — handle with lazy init on first `start()` call after user has already interacted (set logging counts as user gesture)
  - iOS Safari may suspend `AudioContext` — wrap `ctx.resume()` before `oscillator.start()`
  - `useRestTimer` with `setInterval` leaks if component unmounts mid-countdown — clear interval in cleanup
- **New dependencies**: None — Web Audio API is native browser API
