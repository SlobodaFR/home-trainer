# Spec: User Fitness Assessment

**Track ID**: 011-fitness-assessment
**Roadmap ref**: F-011
**Status**: Complete
**Created**: 2026-07-07
**Branch**: feat/011-fitness-assessment
**PRD sections**: FR-1, FR-2, FR-10
**Depends on**: F-006 Goal & Planning — UI — Complete, F-009 LLM Analysis — Complete

## Context

The planner generates sessions without knowing the user's actual fitness level. A beginner and an advanced athlete with the same goal and equipment get the same plan — wrong volume, wrong intensity, wrong exercise complexity. This feature adds a one-time guided assessment (stepper form → single LLM call → profile card confirmation) that produces a `FitnessProfile` stored in DB. The planner and LLM analysis prompt then consume this profile to adapt output to the user's real level.

## User Stories

- As a user, I want to answer a short assessment so the app understands my actual fitness level
- As a user, I want to review the AI-generated profile summary before confirming, so I can catch misinterpretations
- As a user, I want the session plan to reflect my level (volume, intensity, exercise complexity) so training is appropriate
- As a user, I want the LLM analysis to know my level so feedback is contextually relevant
- As a user, I want to redo the assessment later if my level changes

## Functional Requirements

### FR-1: Assessment stepper form

4-step form in a dedicated page `/assessment`:

- **Step 1 — Expérience**: Years of training + self-rated level (`débutant / intermédiaire / avancé`)
- **Step 2 — Limitations**: Injuries or physical constraints (multi-select tags + optional free text). Tags: genoux, dos, épaules, poignets, hanches, aucune.
- **Step 3 — Maîtrise équipement**: Which equipment they're actually comfortable using (subset of declared equipment in Goal — same tag list as GoalFormPage). Level per item not needed; presence = comfortable.
- **Step 4 — Objectif précis**: Free text (max 300 chars) — what specifically the user wants to achieve beyond the goal type (e.g., "progresser sur le squat barre", "retrouver mobilité après blessure épaule").

### FR-2: LLM profile generation

On stepper completion, `POST /api/profile/assess` sends all 4 answers to LLM in one call. LLM returns a structured `FitnessProfileDraft`:

```typescript
{
  level: 'beginner' | 'intermediate' | 'advanced';
  injuryNotes: string;           // human-readable summary of limitations
  equipmentComfortList: string[];
  specificGoal: string;
  summary: string;               // 2-3 sentence natural-language profile shown to user
  plannerConfig: {
    maxSetsPerExercise: number;  // e.g. 3 beginner, 4 intermediate, 5 advanced
    intensityMultiplier: number; // 0.7 / 1.0 / 1.2 — applied to planner defaults
    preferCompound: boolean;     // false for beginner, true for intermediate+
  };
}
```

No storage at this step — preview only.

### FR-3: Profile card + confirmation

After LLM response, user sees a profile card displaying `summary`, `level` badge, and `injuryNotes`. Two actions: **Confirmer** (saves profile) or **Recommencer** (resets stepper). On confirm, `POST /api/profile` stores the profile.

### FR-4: Profile persistence

`UserFitnessProfile` entity: `userId` (unique), `level`, `injuryNotes`, `equipmentComfortList` (JSON array), `specificGoal`, `summary`, `plannerConfig` (JSON), `createdAt`, `updatedAt`. One profile per user, upsert on re-assessment.

### FR-5: Planner integration

`PlannerService` fetches `UserFitnessProfile` for the user before generating sessions. If profile exists, applies `plannerConfig`:

- `maxSetsPerExercise` caps sets per exercise
- `intensityMultiplier` scales default rep targets (e.g. 10 reps × 0.7 = 7 reps for beginner)
- `preferCompound: false` → skip exercises tagged as `compound` when alternatives exist

If no profile: planner behaviour unchanged (backward-compat, defaults stay).

### FR-6: LLM analysis prompt integration

`PromptBuilderService` appends profile `summary` + `level` to the analysis system prompt when a profile exists.

### FR-7: Entry points

- **First-time**: Dashboard shows a "Compléter votre profil" banner if no `UserFitnessProfile` exists for the user. Clicking navigates to `/assessment`.
- **Later**: Settings link (or NavBar profile icon) → `/assessment` → redoes assessment, overwrites profile on confirm.

## API Endpoints Involved

| Method | Path                  | Purpose                                                                            |
| ------ | --------------------- | ---------------------------------------------------------------------------------- |
| POST   | `/api/profile/assess` | Send assessment answers to LLM, return `FitnessProfileDraft` (preview, no storage) |
| POST   | `/api/profile`        | Store confirmed `FitnessProfile` (upsert)                                          |
| GET    | `/api/profile`        | Return current profile (404 if none)                                               |

## Design References

| Surface               | Components used                                                  | New components needed                                               |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/assessment` stepper | `Stepper` (existing), `button-primary`, tag pills                | `AssessmentPage` (new — 4-step form)                                |
| Profile card          | `bg-soft-cloud rounded-lg`, `button-primary`, `button-secondary` | `ProfileCard` (new — summary + level badge + confirm/retry)         |
| Dashboard banner      | existing banner pattern                                          | `ProfileMissingBanner` (new — dismissible "Compléter votre profil") |

## Error Scenarios

- **LLM assess call fails**: Show "Impossible de générer le profil. Réessayer ?" with retry button. Assessment answers preserved so user doesn't retype.
- **Profile save fails**: Toast "Impossible d'enregistrer le profil", stay on profile card (user can retry confirm).
- **No profile on planner**: Silent fallback to defaults — no error surfaced.
- **Assessment form incomplete**: Per-step validation, cannot advance without required fields.

## Acceptance Criteria

- [ ] AC-1: `/assessment` page shows 4-step form (expérience, limitations, équipement, objectif)
- [ ] AC-2: Completing all steps sends one LLM call and displays a profile card with summary + level badge
- [ ] AC-3: Confirming the profile card saves it via `POST /api/profile`; navigates to dashboard
- [ ] AC-4: "Recommencer" resets the stepper without losing the page
- [ ] AC-5: Dashboard shows "Compléter votre profil" banner when no profile exists; banner disappears once profile saved
- [ ] AC-6: `GET /api/profile` returns saved profile; 404 if none
- [ ] AC-7: Planner respects `maxSetsPerExercise` and `intensityMultiplier` from profile when generating sessions
- [ ] AC-8: LLM analysis prompt includes profile `summary` and `level` when profile exists
- [ ] AC-9: Re-running `/assessment` overwrites existing profile on confirm
- [ ] AC-10: If no profile exists, planner and analysis behave exactly as before (no regression)

## Out of Scope

- Per-exercise level granularity (one global level only)
- Progressive overload tracking (separate future feature)
- LLM multi-turn conversation (one-shot only)
- Profile visible/editable as free-form fields (LLM-generated, confirm/retry only in v1)
- NavBar profile icon / settings page (entry point is dashboard banner + direct `/assessment` URL)

## Open Questions

_All resolved._

- **OQ-1** → Nouveaux objectifs seulement. Profil appliqué aux sessions générées après confirmation. Existing sessions unchanged (wipe DB si besoin pendant dev).
- **OQ-2** → Pré-rempli depuis `Goal.availableEquipment` de l'objectif actif. Si aucun objectif actif, étape indépendante.
- **OQ-3** → Banner dashboard suffit en v1. Pas d'icône NavBar.
