# Spec: LLM Analysis

**Track ID**: 009-llm-analysis
**Roadmap ref**: F-009
**Status**: Complete
**Created**: 2026-07-07
**Branch**: feat/009-llm-analysis
**PRD sections**: FR-10, Error Handling
**Depends on**: F-007 (session execution data) — Complete

## Context

After a session finishes, users get no feedback beyond the logged sets. An async LLM job can analyse the session in the context of recent history and surface patterns — volume progression, fatigue signals, consistency — without blocking the finish flow.

## User Stories

- As a user, I want analysis to trigger automatically when I finish a session so I don't have to do anything extra
- As a user, I want to retrieve the analysis result for a session so I can read it when it's ready
- As a user, I want a manual retry if analysis failed so I'm not permanently stuck without a result

## Functional Requirements

### FR-1: Async job triggered on session finish

When `POST /sessions/:id/finish` completes successfully, a `SessionAnalysis` record is created with `status: 'pending'` and the analysis job is fired in the background (fire-and-forget, no await from the HTTP layer). The finish response is not delayed.

### FR-2: Prompt construction

The prompt builder assembles:

- Current session: date, exercises with names, sets logged (reps/weight/duration), RPE, note
- Last 5 completed sessions: same fields
- Goal context: goal type, target, horizon

No PII (no email, no name, no userId). All exercise names only.

The system prompt instructs the LLM to respond in the user's locale (extracted from `Accept-Language` header, fallback `fr`).

### FR-3: LLM provider interface

`LLMService` is an abstract class in the domain layer. `OpenAILLMService` in infrastructure implements it via the OpenAI REST API (`/v1/chat/completions`). Provider selected by `LLM_PROVIDER` env var (default: `openai`).

### FR-4: Retry on failure

If the LLM call fails (network error, non-200 response, timeout), the job retries once automatically. After 2 total attempts, status becomes `'failed'`.

### FR-5: Persistence

`SessionAnalysis` entity:

- `id` (uuid)
- `sessionId` (uuid, unique — one analysis per session)
- `userId` (uuid)
- `status`: `'pending' | 'done' | 'failed'`
- `result`: text or null (Markdown string from LLM)
- `retryCount`: number (0, 1, or 2)
- `createdAt`, `updatedAt`

### FR-6: GET endpoint

`GET /analyses/:sessionId` returns the analysis for a session (owned by the current user). Returns 404 if not found or not owned.

### FR-7: Manual retry endpoint

`POST /analyses/:sessionId/retry` re-queues a failed analysis. Returns 409 if status is not `'failed'`.

## API Endpoints

| Method | Path                             | Purpose                              |
| ------ | -------------------------------- | ------------------------------------ |
| GET    | `/api/analyses/:sessionId`       | Fetch analysis (pending/done/failed) |
| POST   | `/api/analyses/:sessionId/retry` | Re-trigger failed analysis           |

The analysis job is internal — no `POST /analyses` from the client. It's triggered by `FinishSessionUseCase`.

## Error Scenarios

- **LLM unavailable**: session finishes normally, analysis is `failed` after retries. User can retry via POST.
- **Session not found / not owned**: `GET` and `POST retry` return 404.
- **Analysis not failed**: `POST retry` returns 409.
- **Analysis already exists (re-finish)**: skip creating a new analysis if one already exists for this sessionId.

## Acceptance Criteria

- [ ] AC-1: Finishing a session creates a `SessionAnalysis` record with `status: 'pending'`
- [ ] AC-2: The finish HTTP response is not delayed by the LLM call
- [ ] AC-3: A successful LLM call sets `status: 'done'` and stores the result text
- [ ] AC-4: A failed LLM call retries once; after 2 failures sets `status: 'failed'`
- [ ] AC-5: `GET /analyses/:sessionId` returns 200 with analysis when owned by current user
- [ ] AC-6: `GET /analyses/:sessionId` returns 404 for unknown or unowned sessions
- [ ] AC-7: `POST /analyses/:sessionId/retry` re-runs analysis when status is `'failed'`
- [ ] AC-8: `POST /analyses/:sessionId/retry` returns 409 when status is not `'failed'`
- [ ] AC-9: Prompt includes current session + last 5 sessions + goal, no PII
- [ ] AC-10: `LLMService` is an abstract class; `OpenAILLMService` is the concrete adapter

## Out of Scope

- In-app notification / polling UI (F-010)
- Progress history page (F-010)
- Multiple LLM providers beyond OpenAI
- Streaming responses
- Analysis deletion

## Open Questions

_All resolved._

- **OQ-1** → `gpt-4o-mini`
- **OQ-2** → User's preferred locale. Source priority: `preferredLocale` field on user profile (once home-auth adds it), fallback to `Accept-Language` request header, fallback to `fr`. The `LLMService` receives a `locale` string and includes it in the system prompt.

## Out of Scope (deferred)

- Wger multilingual exercise names — seed currently fetches English only. Fetching multi-locale translations (French, etc.) requires changes to the exercise domain model (`translations[]`), seed, and display layer. Tracked separately as a future feature.
