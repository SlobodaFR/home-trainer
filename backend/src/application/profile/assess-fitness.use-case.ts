import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LLMService } from '../../domain/analysis/llm.service';
import type { FitnessProfileDraft } from '../../domain/profile/user-fitness-profile';

export interface AssessInput {
  experience: 'débutant' | 'intermédiaire' | 'avancé';
  yearsTraining: number;
  injuries: string[];
  injuryNote: string;
  equipmentComfort: string[];
  specificGoal: string;
}

const SYSTEM_PROMPT = `You are a certified personal trainer. Based on the user's assessment input, generate a fitness profile.

Respond with ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "level": "beginner" | "intermediate" | "advanced",
  "injuryNotes": "string — human-readable summary of limitations, empty string if none",
  "equipmentComfortList": ["array of equipment strings from input"],
  "specificGoal": "string — refined version of the user's goal",
  "summary": "string — 2-3 sentence natural-language profile for the user to review",
  "plannerConfig": {
    "maxSetsPerExercise": number (3 for beginner, 4 for intermediate, 5 for advanced),
    "intensityMultiplier": number (0.7 for beginner, 1.0 for intermediate, 1.2 for advanced)
  }
}`;

@Injectable()
export class AssessFitnessUseCase {
  constructor(private readonly llmService: LLMService) {}

  async execute(input: AssessInput): Promise<FitnessProfileDraft> {
    const userPrompt = [
      `Self-rated level: ${input.experience}`,
      `Years training: ${String(input.yearsTraining)}`,
      `Injury/limitations tags: ${input.injuries.join(', ') || 'none'}`,
      input.injuryNote ? `Injury details: ${input.injuryNote}` : '',
      `Equipment comfortable with: ${input.equipmentComfort.join(', ') || 'none'}`,
      `Specific goal: ${input.specificGoal}`,
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.llmService.complete(SYSTEM_PROMPT, userPrompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InternalServerErrorException('LLM_PARSE_ERROR');
    }

    const draft = parsed as Partial<FitnessProfileDraft>;
    if (
      !draft.level ||
      !draft.summary ||
      !draft.plannerConfig?.maxSetsPerExercise ||
      !draft.plannerConfig.intensityMultiplier
    ) {
      throw new InternalServerErrorException('LLM_PARSE_ERROR');
    }

    return {
      level: draft.level,
      injuryNotes: draft.injuryNotes ?? '',
      equipmentComfortList:
        draft.equipmentComfortList ?? input.equipmentComfort,
      specificGoal: draft.specificGoal ?? input.specificGoal,
      summary: draft.summary,
      plannerConfig: draft.plannerConfig,
    };
  }
}
