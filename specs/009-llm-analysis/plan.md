# Plan: LLM Analysis

**Spec**: specs/009-llm-analysis/spec.md

## Architecture Decisions

### AD-1: Fire-and-forget via `void` — no queue

- **Choice**: `FinishSessionUseCase` injects `AnalysisJobService` and calls `void this.analysisJobService.run(sessionId, userId, locale)` after saving the session. No Bull, no EventEmitter.
- **Rationale**: Single-user app. Simple, no extra infra. Job runs in the same Node process. Retries handled within the async method.
- **Alternatives considered**: EventEmitter2 (more decoupled but new dep + wiring); Bull queue (overkill, requires Redis or in-memory queue config).

### AD-2: Module isolation — AnalysisModule owns its own repo bindings

- **Choice**: `AnalysisModule` declares its own `TypeOrmModule.forFeature([...])` and binds all abstract repos it needs (Session, Goal, WorkoutLog, SessionAnalysis). Same pattern as PlanningModule and ExecutionModule.
- **Rationale**: Avoids cross-module imports and circular dependency (ExecutionModule would need AnalysisModule, which would need WorkoutLogRepository from ExecutionModule if we tried to share). TypeORM supports the same entity registered in multiple feature modules.

### AD-3: Locale extracted in the controller, threaded through use case

- **Choice**: `ExecutionController.finishSession()` reads `Accept-Language` header, extracts primary tag (`fr`, `en`, etc.), passes to `FinishSessionUseCase.execute()` as a new `locale: string` param, which passes it to `AnalysisJobService.run()`.
- **Rationale**: Business rules (prompt language) depend on locale; keeping extraction at the HTTP layer and threading it as a plain string keeps the domain clean.

### AD-4: LLMService abstract class in domain, OpenAI adapter via native fetch

- **Choice**: `domain/analysis/llm.service.ts` is an abstract class with `abstract complete(systemPrompt: string, userPrompt: string): Promise<string>`. `infrastructure/llm/openai-llm.service.ts` calls OpenAI `/v1/chat/completions` using `fetch` (same pattern as wger-seed).
- **Rationale**: Provider-agnostic interface. No openai SDK dep. Consistent with existing fetch usage in the codebase.

### AD-5: Retry logic is synchronous within the job method

- **Choice**: `AnalysisJobService` has a single private async `doRun(analysisId, sessionId, userId, locale, retryCount)` that catches LLM errors, increments `retryCount` on the DB record, and re-calls itself once if `retryCount === 0`.
- **Rationale**: Simple, testable, no queue needed.

## Affected Files

### New Files

| File                                                                             | Purpose                                         |
| -------------------------------------------------------------------------------- | ----------------------------------------------- |
| `domain/analysis/session-analysis.ts`                                            | `SessionAnalysis` interface + status type       |
| `domain/analysis/session-analysis.repository.ts`                                 | Abstract `SessionAnalysisRepository`            |
| `domain/analysis/llm.service.ts`                                                 | Abstract `LLMService`                           |
| `infrastructure/persistence/entities/session-analysis.orm-entity.ts`             | TypeORM entity                                  |
| `infrastructure/persistence/repositories/typeorm-session-analysis.repository.ts` | Concrete repo                                   |
| `infrastructure/llm/openai-llm.service.ts`                                       | OpenAI adapter (fetch)                          |
| `application/analysis/analysis-job.service.ts`                                   | Fire-and-forget job runner                      |
| `application/analysis/prompt-builder.service.ts`                                 | Builds LLM prompt from session + history + goal |
| `application/analysis/get-analysis.use-case.ts`                                  | `GET /analyses/:sessionId`                      |
| `application/analysis/retry-analysis.use-case.ts`                                | `POST /analyses/:sessionId/retry`               |
| `application/analysis/get-analysis.use-case.spec.ts`                             | Unit tests                                      |
| `application/analysis/retry-analysis.use-case.spec.ts`                           | Unit tests                                      |
| `application/analysis/prompt-builder.service.spec.ts`                            | Unit tests                                      |
| `application/analysis/analysis-job.service.spec.ts`                              | Unit tests                                      |
| `interfaces/http/controllers/analysis.controller.ts`                             | Routes                                          |
| `analysis/analysis.module.ts`                                                    | NestJS module                                   |

### Modified Files

| File                                                  | Change                                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `application/execution/finish-session.use-case.ts`    | Add `locale` param; inject + call `AnalysisJobService`                                                           |
| `interfaces/http/controllers/execution.controller.ts` | Extract `Accept-Language`, pass locale to use case                                                               |
| `execution/execution.module.ts`                       | Import `AnalysisModule`                                                                                          |
| `app.module.ts`                                       | Add `AnalysisModule` + `SessionAnalysisOrmEntity` to TypeORM entities list + Joi validation for `OPENAI_API_KEY` |

## Implementation Phases

### Phase 1: Domain + persistence

- `SessionAnalysis` interface, `SessionAnalysisRepository` abstract class
- `LLMService` abstract class
- `SessionAnalysisOrmEntity` TypeORM entity
- `TypeOrmSessionAnalysisRepository` implementation
- Register entity in `app.module.ts`

### Phase 2: LLM adapter + prompt builder

- `OpenAILLMService` (fetch-based, `gpt-4o-mini`, system prompt includes locale instruction)
- `PromptBuilderService`: assembles system + user prompts from session data, last 5 sessions, goal — no PII
- Unit tests for prompt builder

### Phase 3: Application layer

- `AnalysisJobService.run(sessionId, userId, locale)`: creates pending record, builds prompt, calls LLM, updates status; retries once on failure
- `GetAnalysisUseCase`: find by sessionId, check ownership, 404 if missing/unowned
- `RetryAnalysisUseCase`: check status === 'failed', 409 if not, trigger job
- Unit tests for all three

### Phase 4: HTTP + wiring

- `AnalysisController`: `GET /analyses/:sessionId` + `POST /analyses/:sessionId/retry`
- `AnalysisModule`: TypeOrmModule.forFeature, repo bindings, LLM binding, export AnalysisJobService
- `FinishSessionUseCase`: add `locale` param, call `void this.analysisJobService.run(...)` after completing session
- `ExecutionController`: read `Accept-Language` header, pass locale
- `ExecutionModule`: import `AnalysisModule`
- Update `app.module.ts`

## Test Strategy

- **Mocking approach**: Jest. Mock all abstract repos and `LLMService` with `jest.fn()`. Follow existing spec pattern (no `@nestjs/testing` for unit tests, just direct instantiation).
- **Happy paths**: finish session → analysis record created; LLM returns text → status done + result stored; GET returns analysis; retry re-runs job.
- **Error scenarios**: LLM throws → retryCount increments to 1 → retries → if fails again → status failed; GET on wrong user → 404; retry on non-failed → 409.
- **Prompt builder**: verify no PII in output; verify last 5 sessions (not more) included; verify locale instruction in system prompt.

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**: `FinishSessionUseCase` test spec needs updating (new `locale` param + `AnalysisJobService` mock). OpenAI API key absent in test/CI — `OpenAILLMService` must be fully mocked, never called in tests.
- **New dependencies**: None (native fetch, no openai SDK).
- **Env vars added**: `OPENAI_API_KEY` (required), `LLM_PROVIDER` (optional, default `openai`).
