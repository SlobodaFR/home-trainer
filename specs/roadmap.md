# Trainer — Feature Roadmap

**Generated from**: PRD.md
**Last updated**: 2026-07-04
**Status**: Draft

## Features

### F-001: Project Foundation
**Summary**: Monorepo, Docker, PostgreSQL, and skeleton apps are running locally and in container.
**PRD sections**: Architecture & Tech Stack, Configuration
**Depends on**: None
**Delivers**: npm workspaces (`backend`/`frontend`), NestJS health endpoint, React Vite app, Docker single-image build, TypeORM connected to Postgres, `.env.example`
**Estimated size**: S
**Status**: Complete

---

### F-002: Authentication
**Summary**: User can log in via home-auth magic link and all API routes are protected by JWT guard.
**PRD sections**: Security & Compliance, Configuration
**Depends on**: F-001
**Delivers**: OAuth2 Authorization Code flow, JWKS JWT validation, NestJS `AuthGuard`, `httpOnly` cookie token storage, logout webhook endpoint
**Estimated size**: M
**Status**: Not started

---

### F-003: Exercise Library — Data Layer
**Summary**: Exercise catalog is seeded from Wger and queryable via REST API.
**PRD sections**: FR-8, Integrations (Wger, Everkinetic)
**Depends on**: F-001
**Delivers**: `Exercise` TypeORM entity, Wger one-time seed script, `GET /exercises` (filter by muscle group + equipment), `GET /exercises/:id`, Everkinetic SVG assets bundled in frontend
**Estimated size**: M
**Status**: Not started

---

### F-004: Exercise Library — UI
**Summary**: User can browse, filter, and favorite exercises with muscle diagrams and video links.
**PRD sections**: FR-8, FR-9
**Depends on**: F-002, F-003
**Delivers**: Browse/filter page, exercise detail view (instructions, YouTube embed, Everkinetic SVG), favorites toggle, preference weight input (1–5)
**Estimated size**: M
**Status**: Not started

---

### F-005: Goal & Planning — Data Layer
**Summary**: User can save a goal and the system generates an equipment-aware weekly session plan.
**PRD sections**: FR-1, FR-2, FR-3
**Depends on**: F-003
**Delivers**: `Goal`, `Session`, `SessionExercise` entities, rule-based planning service (equipment + schedule aware), `POST /goals`, `GET /sessions` (upcoming), `POST /sessions/:id/replan`
**Estimated size**: M
**Status**: Not started

---

### F-006: Goal & Planning — UI
**Summary**: User sets a goal and sees upcoming sessions on the dashboard; can request a session swap.
**PRD sections**: FR-1, FR-2, FR-3
**Depends on**: F-002, F-005
**Delivers**: Goal definition form, dashboard with upcoming sessions list, session modification request UI
**Estimated size**: M
**Status**: Not started

---

### F-007: Session Execution — Data Layer
**Summary**: Session state machine and workout logging endpoints are operational.
**PRD sections**: FR-4, FR-5, FR-7
**Depends on**: F-005
**Delivers**: `WorkoutLog` entity, session state machine (`planned → active → paused → completed`), `POST /sessions/:id/start`, `POST /sessions/:id/sets`, `POST /sessions/:id/finish` (with RPE + note)
**Estimated size**: S
**Status**: Not started

---

### F-008: Session Execution — UI
**Summary**: User can execute a full session: log sets, use rest timer, finish with feeling rating.
**PRD sections**: FR-4, FR-5, FR-6, FR-7
**Depends on**: F-006, F-007
**Delivers**: Execution screen, set/rep/weight logging form, configurable rest timer (visual + audio), pause/resume/stop controls, post-session RPE form, optimistic local state + toast on save failure
**Estimated size**: M
**Status**: Not started

---

### F-009: LLM Analysis
**Summary**: After a session, an async LLM job analyses progress and stores the result.
**PRD sections**: FR-10, Error Handling
**Depends on**: F-007
**Delivers**: `LLMService` interface, OpenAI adapter, DB-persisted job (`pending / done / failed`), prompt builder (session + history, no PII), 1-retry on failure, `GET /analyses/:sessionId`
**Estimated size**: M
**Status**: Not started

---

### F-010: Notifications & Progress History
**Summary**: User receives in-app notification when analysis is ready and can view full progress history.
**PRD sections**: FR-10, FR-11
**Depends on**: F-008, F-009
**Delivers**: In-app notification (polling or SSE), analysis-ready alert, progress history page (sessions + volume + linked analysis), analysis detail view
**Estimated size**: M
**Status**: Not started

---

## Dependency Graph

```
F-001 (Foundation)
  ├── F-002 (Auth)
  │     ├── F-004 (Exercise UI) ──────────────────┐
  │     └── F-006 (Planning UI) ─────────────────┐│
  └── F-003 (Exercise data)                       ││
        └── F-005 (Planning data)                 ││
              ├── F-004 ◄──────────────────────────┘│
              ├── F-006 ◄───────────────────────────┘
              └── F-007 (Session data)
                    ├── F-008 (Session UI) ──────────┐
                    └── F-009 (LLM Analysis) ─────────┤
                                                      └── F-010 (Notifications + History)
```

---

## Milestones

### M1: Foundation (F-001 → F-002)
Scaffold running in Docker, auth working end-to-end. Starting point for all feature work.

### M2: Exercise Library (F-003 → F-004)
Exercise catalog browseable and searchable. Planning can reference real exercises.

### M3: Training Loop (F-005 → F-008)
Full loop functional: set goal → auto-plan → execute session → log sets → rate feeling.

### M4: Intelligence & History (F-009 → F-010)
LLM analysis async, notifications, progress history. App feature-complete.
