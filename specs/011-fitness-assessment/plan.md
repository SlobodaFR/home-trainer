# Plan: User Fitness Assessment

**Spec**: specs/011-fitness-assessment/spec.md

## Architecture Decisions

### AD-1: New `ProfileModule` — exported repo consumed by `PlanningModule` + `AnalysisModule`

- **Choice**: `ProfileModule` provides `{ provide: ProfileRepository, useClass: TypeOrmProfileRepository }` and exports it. `PlanningModule` and `AnalysisModule` import `ProfileModule` to inject `ProfileRepository`. `AppModule` also imports `ProfileModule` for route and entity registration.
- **Rationale**: Cleanest way to share a repo without circular deps. Same pattern as how `AnalysisModule` exports `AnalysisJobService`. No cross-domain use-case leakage.
- **Alternatives considered**: Export `GetProfileUseCase` instead of raw repo — adds unnecessary indirection; use cases already simple.

### AD-2: `AssessFitnessUseCase` reuses existing `LLMService` + `OpenAILLMService`

- **Choice**: `ProfileModule` registers `{ provide: LLMService, useClass: OpenAILLMService }` independently (same registration as `AnalysisModule`). `AssessFitnessUseCase` calls `llmService.complete()` with a fitness-assessment system prompt that instructs JSON output. Response parsed with `JSON.parse`; invalid JSON throws `InternalServerErrorException`.
- **Rationale**: Reuses existing abstraction. No new LLM interface needed. `OpenAILLMService` is stateless so double-registration is harmless.
- **Alternatives considered**: Shared `LLMModule` — correct but over-engineered for two consumers.

### AD-3: `PlannerService.buildSessionExercises` accepts optional `FitnessProfileConfig`

- **Choice**: Add optional third param `config?: { maxSetsPerExercise: number; intensityMultiplier: number }`. When present: `sets = config.maxSetsPerExercise`, `repsOrDuration = String(Math.round(10 * config.intensityMultiplier))`. When absent: current defaults (`sets: 3`, `repsOrDuration: '10'`). `CreateGoalUseCase` and `ReplanSessionUseCase` fetch `ProfileRepository.findByUser(userId)` and pass config if profile exists.
- **Rationale**: Backward-compat guaranteed — no profile = no change. `preferCompound` from spec skipped (exercises have no compound tag in DB; future work).
- **Alternatives considered**: New `PlannerService` subclass — unnecessary complexity.

### AD-4: `PromptBuilderService.build` gets optional `profile` param

- **Choice**: Add `profile?: UserFitnessProfile` to `BuildParams`. When present, prepend to system prompt: `"User fitness profile: level=${level}. ${summary}"`. `AnalysisJobService` injects `ProfileRepository`, fetches in `execute()`, passes to `promptBuilder.build()`.
- **Rationale**: Non-breaking change to prompt builder signature. LLM gets richer context without requiring schema change.

### AD-5: Frontend — 4-step wizard via `useState<number>` step index

- **Choice**: `AssessmentPage` manages `step: 0..3` with Back/Suivant buttons. Each step renders its own section. No router navigation between steps. On step 3 submit → `POST /api/profile/assess` → show `ProfileCard` (step index = 4). Equipment step pre-fills from `GET /api/goal/active` → `availableEquipment`.
- **Rationale**: Existing `Stepper` component is a numeric +/- widget, not a wizard; wizard is simpler as local state. Avoids URL params for transient form state.

### AD-6: LLM assess call returns full `FitnessProfileDraft` JSON

- **Choice**: System prompt instructs LLM to respond with **only** a JSON object matching `FitnessProfileDraft` schema. `AssessFitnessUseCase` calls `JSON.parse(rawResponse)`, validates presence of required fields, throws `InternalServerErrorException` if malformed.
- **Rationale**: Single call, no follow-up. JSON parsing is deterministic. GPT-4o reliably follows JSON-only instructions.

## Affected Files

### New Files

| File                                                                                 | Purpose                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `backend/src/domain/profile/user-fitness-profile.ts`                                 | `UserFitnessProfile` + `FitnessProfileConfig` + `FitnessProfileDraft` interfaces |
| `backend/src/domain/profile/profile.repository.ts`                                   | `ProfileRepository` abstract class                                               |
| `backend/src/application/profile/assess-fitness.use-case.ts`                         | LLM call → `FitnessProfileDraft` (no storage)                                    |
| `backend/src/application/profile/assess-fitness.use-case.spec.ts`                    | Mock LLM, test happy path + JSON parse failure                                   |
| `backend/src/application/profile/save-profile.use-case.ts`                           | Upsert confirmed profile                                                         |
| `backend/src/application/profile/get-profile.use-case.ts`                            | Fetch profile or null                                                            |
| `backend/src/infrastructure/persistence/entities/user-fitness-profile.orm-entity.ts` | TypeORM entity (userId unique)                                                   |
| `backend/src/infrastructure/persistence/repositories/typeorm-profile.repository.ts`  | TypeORM impl of `ProfileRepository`                                              |
| `backend/src/interfaces/http/controllers/profile.controller.ts`                      | `POST /assess`, `POST /`, `GET /`                                                |
| `backend/src/interfaces/http/dto/assess-fitness.dto.ts`                              | Input DTO (experience, injuries, equipment, goal text)                           |
| `backend/src/interfaces/http/dto/confirm-profile.dto.ts`                             | Input DTO (full `FitnessProfileDraft` fields)                                    |
| `backend/src/profile/profile.module.ts`                                              | Module wiring                                                                    |
| `frontend/src/infrastructure/profile-client.ts`                                      | `assessFitness()`, `saveProfile()`, `getProfile()`                               |
| `frontend/src/presentation/profile/AssessmentPage.tsx`                               | 4-step wizard + ProfileCard on completion                                        |
| `frontend/src/presentation/profile/ProfileCard.tsx`                                  | Confirms/resets assessment                                                       |
| `frontend/src/presentation/shared/ProfileMissingBanner.tsx`                          | Dashboard banner (dismissible) when no profile                                   |

### Modified Files

| File                                                          | Change                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `backend/src/application/planning/planner.service.ts`         | Add optional `FitnessProfileConfig` to `buildSessionExercises` + `generateSessions` |
| `backend/src/application/planning/create-goal.use-case.ts`    | Inject `ProfileRepository`, fetch profile, pass config to planner                   |
| `backend/src/application/planning/replan-session.use-case.ts` | Same — inject + fetch + pass config                                                 |
| `backend/src/planning/planning.module.ts`                     | Import `ProfileModule`                                                              |
| `backend/src/application/analysis/prompt-builder.service.ts`  | Add `profile?: UserFitnessProfile` to `BuildParams` + system prompt                 |
| `backend/src/application/analysis/analysis-job.service.ts`    | Inject `ProfileRepository`, fetch profile, pass to prompt builder                   |
| `backend/src/analysis/analysis.module.ts`                     | Import `ProfileModule`                                                              |
| `backend/src/app.module.ts`                                   | Import `ProfileModule`, add `UserFitnessProfileOrmEntity` to entities list          |
| `frontend/src/App.tsx`                                        | Add `/assessment` route                                                             |
| `frontend/src/presentation/planning/DashboardPage.tsx`        | Fetch profile on mount, render `ProfileMissingBanner` when null                     |

## Implementation Phases

### Phase 1: Backend domain + persistence

- `UserFitnessProfile`, `FitnessProfileDraft`, `FitnessProfileConfig` domain interfaces
- `ProfileRepository` abstract
- `UserFitnessProfileOrmEntity` (columns: id, userId UNIQUE, level, injuryNotes, equipmentComfortList JSON, specificGoal, summary, plannerConfig JSON, createdAt, updatedAt)
- `TypeOrmProfileRepository` (upsert via `findOne({ userId })` → update or insert)

### Phase 2: Backend use cases + controller + module

- `AssessFitnessUseCase`: build assessment prompt → `llmService.complete()` → `JSON.parse` → validate → return `FitnessProfileDraft`
- `AssessFitnessUseCase.spec.ts`: mock LLM returning valid JSON (happy path), mock LLM returning garbage (throws 500)
- `SaveProfileUseCase`: upsert via `profileRepository.upsert(userId, draft)`
- `GetProfileUseCase`: return `profileRepository.findByUser(userId)` (null if none)
- `AssessFitnessDto` + `ConfirmProfileDto` with class-validator
- `ProfileController`: `POST /api/profile/assess` → assess, `POST /api/profile` → save, `GET /api/profile` → get (404 if null)
- `ProfileModule`: TypeOrmModule.forFeature, providers, exports `[ProfileRepository]`

### Phase 3: Planner + prompt integration

- `PlannerService.buildSessionExercises(goal, exercises, config?)`: when config, use `config.maxSetsPerExercise` + `Math.round(10 * config.intensityMultiplier)` for reps
- `PlannerService.generateSessions(goal, exercises, config?)`: pass config through to `buildSessionExercises`
- `CreateGoalUseCase`: inject `ProfileRepository`, `const profile = await this.profileRepository.findByUser(userId)`, pass `profile?.plannerConfig` to planner
- `ReplanSessionUseCase`: same pattern
- `PlanningModule`: imports `[ProfileModule]`
- `PromptBuilderService.build()`: add `profile?: UserFitnessProfile` to `BuildParams`; when present, prepend `User fitness profile: level=${profile.level}. ${profile.summary}` to systemPrompt
- `AnalysisJobService.execute()`: `const profile = await this.profileRepository.findByUser(userId)`, pass to `promptBuilder.build()`
- `AnalysisModule`: imports `[ProfileModule]`
- `AppModule`: add `ProfileModule` to imports + `UserFitnessProfileOrmEntity` to entities

### Phase 4: Frontend

- `profile-client.ts`: `assessFitness(input)`, `saveProfile(draft)`, `getProfile(): Promise<UserFitnessProfile | null>` (404 → null)
- `AssessmentPage.tsx`:
  - `step: 0..3` state. Step 0: radio group (débutant/intermédiaire/avancé) + years input. Step 1: `MultiFilterChips` for injury tags + optional text. Step 2: `MultiFilterChips` pre-filled from `getActiveGoal()?.availableEquipment`. Step 3: `<textarea>` (300 char max).
  - On step 3 next: call `assessFitness()`, show loading spinner, on success set `draft` and `step = 4`. On error: "Erreur LLM — Réessayer".
  - Step 4 renders `<ProfileCard>`.
- `ProfileCard.tsx`: shows `draft.summary`, level badge (`bg-ink text-canvas rounded-full`), `injuryNotes`. "Confirmer" → `saveProfile(draft)` → navigate `/`. "Recommencer" → reset step to 0.
- `ProfileMissingBanner.tsx`: fetches `getProfile()` on mount; if null and not dismissed, renders top fixed banner "Complétez votre profil d'entraînement" + "Commencer" link to `/assessment` + dismiss button. Dismiss stored in component state (not persisted — reappears on next page load until profile saved).
- `App.tsx`: add `<Route path="assessment" element={<AssessmentPage />} />`
- `DashboardPage.tsx`: render `<ProfileMissingBanner />` at top of page content

## Design Mobilization

- **Tokens**: `ink`, `canvas`, `soft-cloud`, `mute`, `hairline`, `success` (level badge for advanced)
- **Components used**: `MultiFilterChips` (existing), `FilterChips` (existing for level radio-style), `button-primary` pattern (`bg-ink text-canvas rounded-full`)
- **New components**: `AssessmentPage`, `ProfileCard`, `ProfileMissingBanner`
- **States covered**: Loading (LLM call spinner), Error (LLM failure + retry), Success (profile card), Empty (no profile → banner)
- **A11y**: `<fieldset>/<legend>` for radio groups, `aria-pressed` on chips (already on `MultiFilterChips`), `role="status"` on banner

## Test Strategy

- **Mocking**: Jest backend (mock `LLMService`, `ProfileRepository`); Vitest frontend (mock `profile-client`)
- **Happy paths**: `AssessFitnessUseCase` returns valid `FitnessProfileDraft`; planner uses `maxSetsPerExercise` when profile present; prompt builder prepends profile summary
- **Error scenarios**: LLM returns invalid JSON → 500; `getProfile` returns 404 when none; planner falls back to defaults when no profile
- **Edge cases**: Profile exists but `plannerConfig` null (shouldn't happen but guard with `??`); assessment equipment step when no active goal (renders empty selection)

## Risk & Complexity

- **Estimated complexity**: Medium
- **Key risks**: LLM JSON parse reliability — mitigated by explicit system prompt instruction + error handling; `ProfileModule` import in both `PlanningModule` and `AnalysisModule` — verify no circular dep at runtime
- **New dependencies**: None — reuses `LLMService`, `OpenAILLMService`
