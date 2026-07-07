# Tasks: LLM Analysis

**Plan**: specs/009-llm-analysis/plan.md
**Status**: Done
**Total**: 16 tasks across 4 phases

## Phase 1: Domain + Persistence

- [x] **T-1.1**: Create `SessionAnalysis` domain interface and `SessionAnalysisRepository` abstract class
  - **Do**: Create `backend/src/domain/analysis/session-analysis.ts` — export `SessionAnalysis` interface (`id`, `sessionId`, `userId`, `status: 'pending' | 'done' | 'failed'`, `result: string | null`, `retryCount: number`, `createdAt: Date`, `updatedAt: Date`). Create `backend/src/domain/analysis/session-analysis.repository.ts` — abstract class with `findBySessionId(sessionId: string): Promise<SessionAnalysis | null>`, `save(data: Omit<SessionAnalysis, 'id' | 'createdAt' | 'updatedAt'>): Promise<SessionAnalysis>`, `update(id: string, patch: Partial<Pick<SessionAnalysis, 'status' | 'result' | 'retryCount'>>): Promise<void>`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.2**: Create `LLMService` abstract class
  - **Do**: Create `backend/src/domain/analysis/llm.service.ts` — `export abstract class LLMService { abstract complete(systemPrompt: string, userPrompt: string): Promise<string>; }`
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.3**: Create `SessionAnalysisOrmEntity`
  - **Do**: Create `backend/src/infrastructure/persistence/entities/session-analysis.orm-entity.ts` — `@Entity({ name: 'session_analyses' })` with columns: `id` (uuid PK), `sessionId` (text, unique), `userId` (text), `status` (text, default `'pending'`), `result` (text, nullable), `retryCount` (int, default 0), `createdAt` (`@CreateDateColumn`), `updatedAt` (`@UpdateDateColumn`)
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.4**: Create `TypeOrmSessionAnalysisRepository`
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-session-analysis.repository.ts` — `@Injectable()` class extending `SessionAnalysisRepository`, `@InjectRepository(SessionAnalysisOrmEntity)`, implement `findBySessionId`, `save`, `update`. Map ORM entity to domain interface in a private `toDomain()` function.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.5**: Register `SessionAnalysisOrmEntity` in `app.module.ts`
  - **Do**: In `backend/src/app.module.ts`, add `SessionAnalysisOrmEntity` to the `entities` array in `TypeOrmModule.forRootAsync`. Add `OPENAI_API_KEY: Joi.string().required()` and `LLM_PROVIDER: Joi.string().default('openai')` to the Joi validation schema.
  - **Test**: `npm run dev:backend` starts without schema error (or `npx tsc --noEmit --project backend/tsconfig.build.json`)

## Phase 2: LLM Adapter + Prompt Builder

- [x] **T-2.1**: Create `OpenAILLMService`
  - **Do**: Create `backend/src/infrastructure/llm/openai-llm.service.ts` — `@Injectable()` class extending `LLMService`. Constructor injects `ConfigService` to read `OPENAI_API_KEY`. `complete(systemPrompt, userPrompt)` calls `https://api.openai.com/v1/chat/completions` via `fetch` with model `gpt-4o-mini`, messages `[{role:'system', content: systemPrompt}, {role:'user', content: userPrompt}]`. Throws on non-2xx. Returns `choices[0].message.content`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-2.2**: Create `PromptBuilderService` with unit tests
  - **Do**: Create `backend/src/application/analysis/prompt-builder.service.ts` — `@Injectable()` class. Method `build(params: { currentSession: Session, history: Session[], logsBySession: Map<string, WorkoutLog[]>, goal: Goal, locale: string }): { systemPrompt: string, userPrompt: string }`. System prompt instructs LLM to respond in the given locale (e.g. `"Respond in the language identified by locale: ${locale}."`), to act as a sports coach, and to give a concise analysis. User prompt lists: current session date + exercise names + sets (reps/weight/duration) + RPE + note; last 5 sessions in the same format; goal type + target + horizon. No userId, no email. Create `backend/src/application/analysis/prompt-builder.service.spec.ts` — verify: system prompt contains locale string; user prompt contains exercise names; user prompt does not contain userId; user prompt includes at most 5 history sessions.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="prompt-builder" --no-coverage`

## Phase 3: Application Layer

- [x] **T-3.1**: Create `AnalysisJobService`
  - **Do**: Create `backend/src/application/analysis/analysis-job.service.ts` — `@Injectable()` class. Inject `SessionAnalysisRepository`, `SessionRepository`, `GoalRepository`, `WorkoutLogRepository`, `PromptBuilderService`, `LLMService`. Public method `run(sessionId: string, userId: string, locale: string): void` — calls `void this.execute(sessionId, userId, locale)` and returns immediately. Private async `execute(sessionId, userId, locale, attempt = 0)`: (1) skip if analysis already exists for sessionId; (2) create record with `status: 'pending'`; (3) fetch session + last 5 completed sessions + their logs + active goal; (4) build prompt; (5) call `llmService.complete()`; (6) on success: update `status: 'done', result`; (7) on error: if `attempt < 1`, call `this.execute(sessionId, userId, locale, attempt + 1)` — else update `status: 'failed'`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-3.2**: Unit tests for `AnalysisJobService`
  - **Do**: Create `backend/src/application/analysis/analysis-job.service.spec.ts` — mock all repos, `PromptBuilderService`, and `LLMService`. Test: (a) `run()` returns void immediately; (b) on LLM success → save called with `status: 'done'` + result; (c) on first LLM failure → retries once; (d) on two LLM failures → update called with `status: 'failed'`; (e) if analysis already exists → skips repo calls.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="analysis-job" --no-coverage`

- [x] **T-3.3**: Create `GetAnalysisUseCase` with unit tests
  - **Do**: Create `backend/src/application/analysis/get-analysis.use-case.ts` — `execute(sessionId: string, userId: string): Promise<SessionAnalysis>`. Find by sessionId; if `!analysis || analysis.userId !== userId` throw `NotFoundException`. Return analysis. Create `backend/src/application/analysis/get-analysis.use-case.spec.ts` — test: found + owned → returns analysis; not found → 404; found but different userId → 404.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="get-analysis" --no-coverage`

- [x] **T-3.4**: Create `RetryAnalysisUseCase` with unit tests
  - **Do**: Create `backend/src/application/analysis/retry-analysis.use-case.ts` — `execute(sessionId: string, userId: string): Promise<void>`. Find analysis; if missing/unowned → 404; if `status !== 'failed'` → 409; else update `status: 'pending', retryCount: 0` and call `void analysisJobService.run(sessionId, userId, 'fr')`. Create `backend/src/application/analysis/retry-analysis.use-case.spec.ts` — test: not found → 404; wrong user → 404; status `pending` → 409; status `done` → 409; status `failed` → calls job, returns void.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="retry-analysis" --no-coverage`

## Phase 4: HTTP + Wiring

- [x] **T-4.1**: Create `AnalysisController`
  - **Do**: Create `backend/src/interfaces/http/controllers/analysis.controller.ts` — `@Controller()`. `@Get('analyses/:sessionId')` calls `GetAnalysisUseCase`. `@Post('analyses/:sessionId/retry')` calls `RetryAnalysisUseCase`. Both inject `@CurrentUser()` for userId. Return types: `SessionAnalysis` for GET, `void` for POST retry.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-4.2**: Create `AnalysisModule`
  - **Do**: Create `backend/src/analysis/analysis.module.ts` — `TypeOrmModule.forFeature([SessionAnalysisOrmEntity, SessionOrmEntity, SessionExerciseOrmEntity, GoalOrmEntity, WorkoutLogOrmEntity])`. Providers: `GetAnalysisUseCase`, `RetryAnalysisUseCase`, `AnalysisJobService`, `PromptBuilderService`, `{ provide: SessionAnalysisRepository, useClass: TypeOrmSessionAnalysisRepository }`, `{ provide: SessionRepository, useClass: TypeOrmSessionRepository }`, `{ provide: GoalRepository, useClass: TypeOrmGoalRepository }`, `{ provide: WorkoutLogRepository, useClass: TypeOrmWorkoutLogRepository }`, `{ provide: LLMService, useClass: OpenAILLMService }`. Exports: `[AnalysisJobService]`. Controller: `[AnalysisController]`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-4.3**: Update `FinishSessionUseCase` to trigger analysis
  - **Do**: In `backend/src/application/execution/finish-session.use-case.ts`, add `locale: string` as 5th parameter to `execute()`. Inject `AnalysisJobService` in constructor. After `updateStatus(sessionId, 'completed')`, add `this.analysisJobService.run(sessionId, userId, locale)` (no `void` needed since `run()` returns `void` synchronously). Return the session.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="finish-session" --no-coverage`

- [x] **T-4.4**: Update `ExecutionController` to extract and pass locale
  - **Do**: In `backend/src/interfaces/http/controllers/execution.controller.ts`, update `finishSession()`: add `@Headers('accept-language') acceptLanguage: string | undefined` parameter. Extract primary locale: `const locale = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim() ?? 'fr'`. Pass `locale` as 5th arg to `finishSessionUseCase.execute()`.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="execution.controller" --no-coverage`

- [x] **T-4.5**: Update `ExecutionModule` and `AppModule`
  - **Do**: In `backend/src/execution/execution.module.ts`, add `AnalysisModule` to `imports`. In `backend/src/app.module.ts`, add `AnalysisModule` to the `imports` list (after `ExecutionModule`).
  - **Test**: `npm run test --workspace=backend -- --no-coverage` (full backend suite)

- [x] **T-4.6**: Fix `finish-session.use-case.spec.ts` for new signature
  - **Do**: In `backend/src/application/execution/finish-session.use-case.spec.ts`, add a mock `AnalysisJobService` (`{ run: jest.fn() }`) as a provider. Update all `useCase.execute(id, userId, rpe, note)` calls to `useCase.execute(id, userId, rpe, note, 'fr')`. Verify `analysisJobService.run` is called when session finishes successfully.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="finish-session" --no-coverage`
