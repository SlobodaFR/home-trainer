# Tasks: User Fitness Assessment

**Plan**: specs/011-fitness-assessment/plan.md
**Status**: Complete
**Total**: 20 tasks across 5 phases

## Phase 1: Backend domain + persistence

- [x] **T-1.1**: Domain interfaces
  - **Do**: Create `backend/src/domain/profile/user-fitness-profile.ts`. Export `FitnessProfileConfig { maxSetsPerExercise: number; intensityMultiplier: number }`, `FitnessProfileDraft { level: 'beginner'|'intermediate'|'advanced'; injuryNotes: string; equipmentComfortList: string[]; specificGoal: string; summary: string; plannerConfig: FitnessProfileConfig }`, `UserFitnessProfile extends FitnessProfileDraft { id: string; userId: string; createdAt: Date; updatedAt: Date }`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.2**: Abstract repository
  - **Do**: Create `backend/src/domain/profile/profile.repository.ts`. Abstract class `ProfileRepository` with methods: `findByUser(userId: string): Promise<UserFitnessProfile | null>`, `upsert(userId: string, draft: FitnessProfileDraft): Promise<UserFitnessProfile>`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.3**: TypeORM entity
  - **Do**: Create `backend/src/infrastructure/persistence/entities/user-fitness-profile.orm-entity.ts`. `@Entity('user_fitness_profiles')` with columns: `id` (uuid primary), `userId` (varchar unique), `level` (varchar), `injuryNotes` (text), `equipmentComfortList` (simple-json), `specificGoal` (text), `summary` (text), `plannerConfig` (simple-json), `createdAt` (datetime created), `updatedAt` (datetime updated). Add `UserFitnessProfileOrmEntity` to `AppModule` entities list.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-1.4**: TypeORM repository
  - **Do**: Create `backend/src/infrastructure/persistence/repositories/typeorm-profile.repository.ts`. Extends `ProfileRepository`. `findByUser`: `this.repo.findOne({ where: { userId } })` → map or null. `upsert`: find by userId, if exists update fields + save, else create + save. Map ORM entity to domain `UserFitnessProfile`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

## Phase 2: Backend use cases + controller + module

- [x] **T-2.1**: `AssessFitnessUseCase` + spec
  - **Do**: Create `backend/src/application/profile/assess-fitness.use-case.ts`. Injectable, injects `LLMService`. Method `execute(input: { experience: string; yearsTraining: number; injuries: string[]; injuryNote: string; equipmentComfort: string[]; specificGoal: string }): Promise<FitnessProfileDraft>`. Build system prompt instructing JSON-only response matching `FitnessProfileDraft` schema. Build user prompt summarising input. Call `llmService.complete()`. `JSON.parse` result. Validate required fields (`level`, `summary`, `plannerConfig`). Throw `InternalServerErrorException('LLM_PARSE_ERROR')` if invalid. Create `backend/src/application/profile/assess-fitness.use-case.spec.ts`: mock `LLMService`. Test (1) valid JSON → returns draft, (2) invalid JSON → throws 500.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="assess-fitness"`

- [x] **T-2.2**: `SaveProfileUseCase` + `GetProfileUseCase`
  - **Do**: Create `backend/src/application/profile/save-profile.use-case.ts`. Injects `ProfileRepository`. `execute(userId, draft): Promise<UserFitnessProfile>` → calls `profileRepository.upsert(userId, draft)`. Create `backend/src/application/profile/get-profile.use-case.ts`. Injects `ProfileRepository`. `execute(userId): Promise<UserFitnessProfile | null>` → calls `profileRepository.findByUser(userId)`.
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-2.3**: DTOs
  - **Do**: Create `backend/src/interfaces/http/dto/assess-fitness.dto.ts`. Class `AssessFitnessDto` with class-validator: `experience: string` (@IsString @IsIn(['débutant','intermédiaire','avancé'])), `yearsTraining: number` (@IsNumber @Min(0) @Max(50)), `injuries: string[]` (@IsArray @IsString({ each: true })), `injuryNote: string` (@IsString @IsOptional), `equipmentComfort: string[]` (@IsArray), `specificGoal: string` (@IsString @MaxLength(300)). Create `backend/src/interfaces/http/dto/confirm-profile.dto.ts` with same fields as `FitnessProfileDraft` (all @IsString/@IsArray/@IsObject).
  - **Test**: `npx tsc --noEmit --project backend/tsconfig.build.json`

- [x] **T-2.4**: `ProfileController` + `ProfileModule`
  - **Do**: Create `backend/src/interfaces/http/controllers/profile.controller.ts`. `@Controller('profile')`. `@Post('assess')` → `AssessFitnessUseCase.execute()`. `@Post()` → `SaveProfileUseCase.execute()`. `@Get()` → `GetProfileUseCase.execute()` (if null → `throw new NotFoundException()`). All use `@CurrentUser()`. Create `backend/src/profile/profile.module.ts`. TypeOrmModule.forFeature([UserFitnessProfileOrmEntity]). Providers: AssessFitnessUseCase, SaveProfileUseCase, GetProfileUseCase, { provide: ProfileRepository, useClass: TypeOrmProfileRepository }, { provide: LLMService, useClass: OpenAILLMService }. Controllers: [ProfileController]. Exports: [ProfileRepository].
  - **Test**: `npm run test --workspace=backend -- --no-coverage` (compile check)

## Phase 3: Planner + prompt integration

- [x] **T-3.1**: `PlannerService` — optional config param
  - **Do**: Modify `backend/src/application/planning/planner.service.ts`. Add `config?: FitnessProfileConfig` as third param to `buildSessionExercises(goal, exercises, config?)`. When config: `sets = config.maxSetsPerExercise`, `repsOrDuration = String(Math.round(10 * config.intensityMultiplier))`. Add same optional param to `generateSessions(goal, exercises, config?)`, pass through to `buildSessionExercises`. Import `FitnessProfileConfig` from domain.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="planner.service"`

- [x] **T-3.2**: `CreateGoalUseCase` — inject profile
  - **Do**: Modify `backend/src/application/planning/create-goal.use-case.ts`. Add `ProfileRepository` to constructor. After building `enriched`, do `const profile = await this.profileRepository.findByUser(userId)`. Pass `profile?.plannerConfig ?? undefined` as third arg to `plannerService.generateSessions(goal, enriched, profile?.plannerConfig ?? undefined)`.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="create-goal"`

- [x] **T-3.3**: `ReplanSessionUseCase` — inject profile
  - **Do**: Same pattern as T-3.2 for `ReplanSessionUseCase`. Add `ProfileRepository` to constructor. Fetch profile. Pass config to `plannerService.buildSessionExercises(goal, enriched, profile?.plannerConfig ?? undefined)`.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="replan-session"`

- [x] **T-3.4**: `PlanningModule` imports `ProfileModule`
  - **Do**: Modify `backend/src/planning/planning.module.ts`. Add `ProfileModule` to imports array. Import `ProfileModule` from `../profile/profile.module`.
  - **Test**: `npm run test --workspace=backend -- --no-coverage`

- [x] **T-3.5**: `PromptBuilderService` — optional profile param
  - **Do**: Modify `backend/src/application/analysis/prompt-builder.service.ts`. Add `profile?: UserFitnessProfile` to `BuildParams` interface. When profile present, prepend `User fitness profile: level=${profile.level}. ${profile.summary}` to the system prompt array.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="prompt-builder"`

- [x] **T-3.6**: `AnalysisJobService` — fetch + pass profile
  - **Do**: Modify `backend/src/application/analysis/analysis-job.service.ts`. Add `ProfileRepository` to constructor. In `execute()`, add `const profile = await this.profileRepository.findByUser(userId)` (alongside existing parallel fetches). Pass `profile ?? undefined` to `promptBuilder.build({ ..., profile })`.
  - **Test**: `npm run test --workspace=backend -- --testPathPattern="analysis-job"`

- [x] **T-3.7**: `AnalysisModule` imports `ProfileModule` + `AppModule` wiring
  - **Do**: Modify `backend/src/analysis/analysis.module.ts` — add `ProfileModule` to imports. Modify `backend/src/app.module.ts` — add `ProfileModule` to imports array + `UserFitnessProfileOrmEntity` to entities list.
  - **Test**: `npm run test --workspace=backend -- --no-coverage`

## Phase 4: Frontend

- [x] **T-4.1**: `profile-client.ts`
  - **Do**: Create `frontend/src/infrastructure/profile-client.ts`. `request<T>()` helper (same pattern as other clients). Export `AssessInput` type (mirrors `AssessFitnessDto`). Export `FitnessProfileDraft` + `UserFitnessProfile` types. `assessFitness(input: AssessInput): Promise<FitnessProfileDraft>` → `POST /api/profile/assess`. `saveProfile(draft: FitnessProfileDraft): Promise<UserFitnessProfile>` → `POST /api/profile`. `getProfile(): Promise<UserFitnessProfile | null>` → `GET /api/profile`, 404 → null.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-4.2**: `AssessmentPage.tsx` — wizard steps 0–3
  - **Do**: Create `frontend/src/presentation/profile/AssessmentPage.tsx`. State: `step: 0..4`, `experience: ''`, `yearsTraining: 0`, `injuries: string[]`, `injuryNote: ''`, `equipmentComfort: string[]`, `specificGoal: ''`, `draft: FitnessProfileDraft | null`, `loading: false`, `error: ''`. Step 0: `FilterChips` for level (débutant/intermédiaire/avancé) + number input for years. Step 1: `MultiFilterChips` for injury tags (genoux/dos/épaules/poignets/hanches/aucune) + optional textarea. Step 2: `MultiFilterChips` for equipment — pre-fill via `getActiveGoal()` on mount (if null, empty). Step 3: `<textarea maxLength={300}>` for specificGoal. Navigation: Back/Suivant buttons. Per-step validation (required fields). On step 3 submit: `setLoading(true)` → `assessFitness(...)` → on success `setDraft(result); setStep(4)` → on error `setError('Erreur LLM — Réessayer')`.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-4.3**: `ProfileCard.tsx`
  - **Do**: Create `frontend/src/presentation/profile/ProfileCard.tsx`. Props: `{ draft: FitnessProfileDraft; onReset: () => void }`. Shows `draft.summary` (prose), level badge (`bg-ink text-canvas rounded-full px-3 py-1 text-sm`), `draft.injuryNotes` if non-empty. "Confirmer" button → `saveProfile(draft)` → `navigate('/')`. "Recommencer" → `onReset()`. Loading state on confirm. Error toast on save failure.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-4.4**: `ProfileMissingBanner.tsx`
  - **Do**: Create `frontend/src/presentation/shared/ProfileMissingBanner.tsx`. On mount: `getProfile()` → if null and not dismissed, show fixed top banner (below `AnalysisBanner` z-index, use `z-40`): "Complétez votre profil d'entraînement pour des séances adaptées." + `<Link to="/assessment">` "Commencer" (pill CTA) + dismiss ✕ (`aria-label="Fermer"`). `role="status"`. Local `dismissed` state (useState). If profile exists or dismissed → `return null`.
  - **Test**: `npx tsc --noEmit --project frontend/tsconfig.app.json`

- [x] **T-4.5**: Wire routes + banner into App + DashboardPage
  - **Do**: In `frontend/src/App.tsx`: import `AssessmentPage`, add `<Route path="assessment" element={<AssessmentPage />} />`. In `frontend/src/presentation/planning/DashboardPage.tsx`: import `ProfileMissingBanner`, render `<ProfileMissingBanner />` at top of page content div.
  - **Test**: `npm run lint`

## Phase 5: Quality gates

- [x] **T-5.1**: Full quality gates
  - **Do**: Run `npm run test`, `npm run lint`, `npx tsc --noEmit --project backend/tsconfig.build.json`, `npx tsc --noEmit --project frontend/tsconfig.app.json`. Fix all failures.
  - **Test**: All commands exit 0
