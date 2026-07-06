# Spec: Session Execution — UI

**Track ID**: 008-session-execution-ui
**Roadmap ref**: F-008
**Status**: Complete
**Created**: 2026-07-06
**Branch**: feat/008-session-execution-ui
**PRD sections**: FR-4, FR-5, FR-6, FR-7
**Depends on**: F-006 (Complete), F-007 (Complete)

## Context

Backend execution layer (F-007) is complete: start/pause/resume/finish endpoints, set logging, workout log storage. Users can currently view upcoming sessions from the dashboard and navigate to `SessionDetailPage`, but there is no way to actually execute a session — no controls, no set logging form, no timer. This feature adds the full execution UI: the session transitions from planned → active → completed, with per-set logging and a configurable rest timer between sets.

## User Stories

- As a user, I want to start a planned session from the dashboard so I can begin training
- As a user, I want to log each set (reps, weight, duration) as I complete it so my workout is tracked
- As a user, I want a rest timer to auto-start after each logged set so I don't need to watch the clock
- As a user, I want to pause and resume a session so I can handle interruptions
- As a user, I want to finish a session and rate my perceived effort so I can track training intensity
- As a user, I want to see my previously logged sets for the current session so I know my progress
- As a user, I want failed set-saves to retain locally and show a toast so I don't lose data on flaky network

## Functional Requirements

### FR-1: Execution entry point

`SessionDetailPage` (`/sessions/:id`) gains a "Start Session" button when `status === 'planned'`. Tapping it calls `POST /api/sessions/:id/start`, then navigates to `ExecutionPage` (`/sessions/:id/execute`).

### FR-2: Execution page layout

`ExecutionPage` shows: session header (date, goal type), exercise list with set logging form per exercise, active controls (Pause / Finish), and the rest timer. On mount, if `status === 'paused'`, show Resume instead of Pause.

### FR-3: Set logging form

For each exercise in the session, a compact form allows logging one set at a time: set number (auto-incremented from logged sets count + 1), reps (integer, optional), weight in kg (decimal, optional), duration in seconds (integer, optional). Submitting calls `POST /api/sessions/:id/sets`. The new log entry appears instantly (optimistic) in the "Logged sets" list for that exercise.

### FR-4: Rest timer

After a set is logged, a countdown timer auto-starts for 90 seconds (default, not configurable in this track). Visual: progress ring or countdown display. Audio: a short beep on `timeEnd` via the Web Audio API (no file dependency). Timer can be dismissed early. Timer does NOT block further set logging.

### FR-5: Pause / Resume

"Pause" button calls `POST /api/sessions/:id/pause`, updates local status to `'paused'`, replaces button with "Resume". "Resume" calls `POST /api/sessions/:id/resume`, updates local status to `'active'`, replaces button with "Pause".

### FR-6: Finish + RPE modal

"Finish" button calls `POST /api/sessions/:id/finish` with optional `{ rpe, note }`. A modal appears first: RPE slider 1–10 (optional), free-text note (optional, max 1000 chars), "Finish Session" CTA. On success, navigate to `/` (dashboard). The modal can be dismissed (session stays active).

### FR-7: Optimistic local state + error toast

Set log calls are optimistic: the new log appears in the UI immediately. If `POST /api/sessions/:id/sets` fails, the optimistic entry is removed and a toast appears: "Set non enregistré — réessayez." (match PRD's French tone). Toast auto-dismisses after 4 seconds.

### FR-8: Update planning-client types

Add `'paused'` to `Session.status` union. Add `rpe: number | null` and `note: string | null` to `Session`. Add `WorkoutLog` type and execution API call wrappers: `startSession`, `pauseSession`, `resumeSession`, `finishSession`, `logSet`, `getSets`.

## API Endpoints Used

| Method | Path                     | Purpose                                             |
| ------ | ------------------------ | --------------------------------------------------- |
| POST   | /api/sessions/:id/start  | Transition planned → active                         |
| POST   | /api/sessions/:id/pause  | Transition active → paused                          |
| POST   | /api/sessions/:id/resume | Transition paused → active                          |
| POST   | /api/sessions/:id/finish | Transition active/paused → completed, save RPE/note |
| POST   | /api/sessions/:id/sets   | Log a set                                           |
| GET    | /api/sessions/:id/sets   | Fetch all logged sets for session                   |

## Design References

| Surface                          | Components used                                                                                        | New components needed                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| SessionDetailPage (start CTA)    | `button-primary`                                                                                       | —                                          |
| ExecutionPage — header           | `heading-xl`, `mute` text                                                                              | —                                          |
| ExecutionPage — exercise cards   | `soft-cloud` card, `heading-md`, `body-md`                                                             | ExerciseSetCard (new)                      |
| Set logging form                 | `search-pill` inputs (number fields), `button-primary`                                                 | —                                          |
| Rest timer                       | `button-secondary` (dismiss)                                                                           | RestTimer (new, progress ring + countdown) |
| Pause / Resume / Finish controls | `button-primary`, `button-secondary`                                                                   | —                                          |
| RPE modal                        | `filter-chip` / `filter-chip-active` for RPE scale, `button-primary` finish, `button-secondary` cancel | RPEModal (new)                             |
| Error toast                      | `badge-promo` styled toast at bottom                                                                   | Toast (new, auto-dismiss)                  |

All new components use existing tokens only. No new design tokens required.

## Error Scenarios

- Start/pause/resume/finish API error → toast "Erreur réseau — réessayez." (same toast system)
- Session already in wrong state (409 from backend) → toast with server message
- Set log failure → remove optimistic entry, toast "Set non enregistré — réessayez."
- Session not found (404) on mount → redirect to `/` with toast

## Acceptance Criteria

- [ ] AC-1: "Start Session" button visible on `SessionDetailPage` when `status === 'planned'`; clicking calls `POST /start` and navigates to `/sessions/:id/execute`
- [ ] AC-2: `ExecutionPage` loads session + existing sets on mount; shows exercise list with set count badges
- [ ] AC-3: Submitting set form calls `POST /sets`; entry appears optimistically before response
- [ ] AC-4: If `POST /sets` fails, optimistic entry removed and toast shown
- [ ] AC-5: Rest timer starts automatically after each successful set log; shows countdown; beeps on end
- [ ] AC-6: Timer can be dismissed early without side effects
- [ ] AC-7: Pause button calls `POST /pause`; UI switches to "Resume" state
- [ ] AC-8: Resume button calls `POST /resume`; UI switches back to "Pause" state
- [ ] AC-9: Finish button opens RPE modal; submitting calls `POST /finish` with rpe/note; navigates to `/`
- [ ] AC-10: RPE modal can be dismissed without finishing the session
- [ ] AC-11: `Session.status` type includes `'paused'`; `Session` type includes `rpe`/`note`; execution API functions exported from `planning-client.ts`

## Out of Scope

- Configurable rest timer duration (fixed at 90s in this track)
- Exercise instruction / video view during execution (F-004 already covers exercise detail)
- Offline queue / service worker (optimistic state + toast is sufficient per PRD)
- Push notifications or audio other than the rest timer beep
- History / past sessions view (F-011 or later)

## Open Questions

- None — all decisions derivable from PRD + existing patterns.
