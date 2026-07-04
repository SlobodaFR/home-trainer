# Trainer — Product Requirements Document

**Last updated**: 2026-07-04
**Status**: Draft

## 1. Overview

### Problem Statement
No app combines goal-driven session planning (like Kiprun Pacer) with strength & mobility tracking. Existing tools either plan or track — none do both with equipment-aware scheduling and LLM-powered progress analysis.

### Goals & Success Metrics
- Plan and execute strength/mobility sessions from a single app
- LLM analysis after each session surfaces progress patterns
- Personal use: frictionless daily training loop

### Target Users
| Persona | Description | Primary needs |
|---------|-------------|---------------|
| Solo athlete | Single user (Thomas), intermediate, home/gym training | Goal setting, auto-planning, session execution |

---

## 2. User Stories

### Goal & Planning
- As a user, I want to define a training goal so sessions are planned toward it
- As a user, I want sessions auto-scheduled based on my weekly availability and available equipment
- As a user, I want to request a session modification so planning adapts to my day

### Session Execution
- As a user, I want to see upcoming sessions on the home screen so I know what's next
- As a user, I want to start/pause/stop a session and log reps, sets, weight, or completion
- As a user, I want a rest timer between sets so I don't need to watch the clock

### Exercise Library
- As a user, I want to browse exercises with instructions and video so I know how to perform them
- As a user, I want to mark favorites and weight exercises so planning prioritizes them

### Progress & Analysis
- As a user, I want to rate session difficulty/feeling after finishing
- As a user, I want to receive an async LLM analysis notification when my progress is summarized
- As a user, I want to view analysis history to track trends over time

---

## 3. Functional Requirements

### Goal & Planning
#### FR-1: Goal definition
User sets a training objective (e.g., "improve squat strength", "increase shoulder mobility") with a target timeframe.
**Acceptance criteria**:
- [ ] Goal saved with type, target, and horizon
- [ ] Goal visible on dashboard

#### FR-2: Auto session planning
System generates a weekly session plan based on goal, availability slots, and declared equipment.
**Acceptance criteria**:
- [ ] Sessions created for the next N days on save
- [ ] Each session respects equipment constraints
- [ ] User can request a replanning of a specific session

#### FR-3: Session modification
User can request a change to a planned session (swap day, reduce intensity, change muscle group).
**Acceptance criteria**:
- [ ] Modification request triggers replanning of that session only

### Session Execution
#### FR-4: Session view & start
Home screen shows upcoming sessions. User taps to start.
**Acceptance criteria**:
- [ ] Upcoming sessions listed in chronological order
- [ ] Start button launches execution mode

#### FR-5: Workout logging
During session, user logs each exercise: reps, sets, weight (optional), or completion checkbox.
**Acceptance criteria**:
- [ ] Each set logged with timestamp
- [ ] Pause and resume supported
- [ ] Session terminable at any point (partial saves)

#### FR-6: Rest timer
Between sets, countdown timer auto-starts with configurable duration.
**Acceptance criteria**:
- [ ] Default rest duration configurable per exercise
- [ ] Visual + audio alert on timer end

#### FR-7: Post-session feeling
After finishing, user rates perceived effort and optional note.
**Acceptance criteria**:
- [ ] RPE scale (1–10) or emoji scale
- [ ] Optional free-text note
- [ ] Triggers async LLM analysis job

### Exercise Library
#### FR-8: Exercise catalog
Browseable library with name, muscle groups, instructions, video link.
**Acceptance criteria**:
- [ ] Filter by muscle group and equipment
- [ ] Each exercise shows instructions and optional YouTube link
- [ ] Muscle activation diagram (Everkinetic SVG)

#### FR-9: Favorites & weighting
User can favorite exercises and set preference weight (planning bias).
**Acceptance criteria**:
- [ ] Favorites surface first in planning
- [ ] Weight value (1–5) influences session generation frequency

### Progress & Analysis
#### FR-10: LLM analysis
After post-session rating, async job sends session + history context to LLM. User notified when done.
**Acceptance criteria**:
- [ ] Analysis job runs in background (no blocking UI)
- [ ] In-app notification when analysis is ready
- [ ] Fallback message on LLM failure + 1 retry
- [ ] Provider-agnostic LLM interface (OpenAI by default)

#### FR-11: Progress history
User views past sessions, logged sets, and LLM analyses.
**Acceptance criteria**:
- [ ] Session list with date, exercises, volume
- [ ] Analysis entries linked to their session

---

## 4. Non-Functional Requirements

### Performance
- Single user — no concurrency requirements
- LLM analysis: async, target < 30s end-to-end
- API responses: < 300ms p95 for local VPS

### Reliability
- Session logs must not be lost on network drop (optimistic local state)
- LLM job persisted in DB, survives app restart

### Scalability
- Single-user VPS deployment; no horizontal scaling needed

---

## 5. Architecture & Tech Stack

### System Architecture
```
Browser (React SPA)
    │  OAuth2 Authorization Code (JWT RS256)
    ▼
NestJS API ──── PostgreSQL
    │
    ├── home-auth (OAuth2 / JWKS validation)
    ├── LLM service (OpenAI, provider-agnostic interface)
    └── Exercise seed data (Wger API → local DB)
```

### Tech Stack
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind | Aligned with home-auth stack |
| Backend | NestJS + TypeORM | Aligned with home-auth stack |
| Database | PostgreSQL | Relational complexity (sessions, sets, exercises, plans) |
| Monorepo | npm workspaces | Same pattern as home-auth |
| Container | Docker (single image) | VPS deployment parity with home-auth |
| Auth | home-auth OAuth2 | Existing SSO infrastructure |
| LLM | OpenAI (provider-agnostic interface) | Swap-ready for other providers |

### Integrations
| System | Purpose | Interface |
|--------|---------|-----------|
| home-auth | Authentication + user identity | OAuth2 Authorization Code + JWKS JWT validation |
| OpenAI API | Post-session analysis | REST, abstracted behind `LLMService` interface |
| Wger | Exercise library seed data | REST API → one-time import to local DB |
| YouTube | Exercise video links | Manual URL per exercise (no API needed) |
| Everkinetic | Muscle activation diagrams | Static SVG assets bundled in frontend |

---

## 6. Error Handling

### User-Facing Errors
- LLM failure: "Analyse indisponible" banner + "Réessayer" button (1 retry max)
- Session save failure: toast warning, data retained in local state

### Internal Error Patterns
- Structured logging via NestJS logger
- LLM job status tracked in DB (`pending` / `done` / `failed`)

### Graceful Degradation
- LLM unavailable: session saves normally, analysis marked failed, user can retry later
- home-auth unreachable: standard OAuth error page

---

## 7. Security & Compliance

### Authentication & Authorization
- OAuth2 Authorization Code flow via home-auth
- Access token (JWT RS256) validated against JWKS endpoint
- Logout webhook endpoint to invalidate local sessions

### Data Privacy
- No PII stored beyond `userId` from JWT
- Training data stored on user-controlled VPS
- No GDPR obligations (personal use, single user)

### Compliance
N/A

---

## 8. Configuration

### Environment Variables
| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_BASE_URL` | home-auth base URL | Yes |
| `OAUTH_CLIENT_ID` | OAuth2 client ID | Yes |
| `OAUTH_CLIENT_SECRET` | OAuth2 client secret | Yes |
| `OAUTH_REDIRECT_URI` | OAuth2 redirect URI | Yes |
| `OPENAI_API_KEY` | LLM provider key | Yes |
| `LLM_PROVIDER` | LLM provider selector (default: `openai`) | No |
| `APP_URL` | Public app URL (CORS, redirects) | Yes |

---

## 9. Implementation Sequence

### Phase 1: Foundation
- Monorepo setup (npm workspaces, Docker, Postgres)
- home-auth OAuth2 integration (login, JWKS validation, logout webhook)
- Base DB schema (users, exercises, sessions, sets, goals)

### Phase 2: Exercise Library
- Seed from Wger API → local exercises table
- Browse/filter UI with muscle group, equipment, YouTube link, Everkinetic SVG
- Favorites + weighting

### Phase 3: Goal & Planning
- Goal definition form
- Session auto-planner (rule-based, equipment-aware)
- Session modification request

### Phase 4: Session Execution
- Session start/pause/stop flow
- Set/rep logging UI with rest timer
- Post-session feeling input

### Phase 5: LLM Analysis & Progress
- Async LLM job queue (Bull or simple DB polling)
- Provider-agnostic `LLMService` (OpenAI first)
- In-app notification on analysis ready
- Progress history view

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM analysis quality poor | Low frustration | Medium | Prompt engineering, user can ignore |
| Wger data gaps (exercises missing) | Library incomplete | Low | Manual curation fallback |
| Session planner logic too rigid | Poor UX | Medium | Manual modification request as escape hatch |
| home-auth dependency | Blocked login | Low | Already deployed and stable |

---

## 11. Out of Scope

- Nutrition tracking
- Social sharing / activity feed
- Garmin / wearable integration
- Native mobile app (PWA acceptable)
- Multi-user support
