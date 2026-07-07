import { InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AssessFitnessUseCase } from './assess-fitness.use-case';
import { LLMService } from '../../domain/analysis/llm.service';

const VALID_DRAFT = {
  level: 'intermediate',
  injuryNotes: 'Mild knee sensitivity',
  equipmentComfortList: ['barbell', 'dumbbell'],
  specificGoal: 'Improve squat strength',
  summary: 'Intermediate athlete with mild knee issues targeting strength.',
  plannerConfig: { maxSetsPerExercise: 4, intensityMultiplier: 1.0 },
};

const INPUT = {
  experience: 'intermédiaire' as const,
  yearsTraining: 3,
  injuries: ['genoux'],
  injuryNote: 'douleur légère',
  equipmentComfort: ['barbell', 'dumbbell'],
  specificGoal: 'progresser sur le squat',
};

describe('AssessFitnessUseCase', () => {
  let useCase: AssessFitnessUseCase;
  let llmService: { complete: jest.Mock };

  beforeEach(async () => {
    llmService = { complete: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AssessFitnessUseCase,
        { provide: LLMService, useValue: llmService },
      ],
    }).compile();
    useCase = module.get(AssessFitnessUseCase);
  });

  it('returns FitnessProfileDraft on valid LLM JSON', async () => {
    llmService.complete.mockResolvedValue(JSON.stringify(VALID_DRAFT));
    const result = await useCase.execute(INPUT);
    expect(result.level).toBe('intermediate');
    expect(result.plannerConfig.maxSetsPerExercise).toBe(4);
    expect(result.summary).toContain('Intermediate');
  });

  it('throws 500 when LLM returns invalid JSON', async () => {
    llmService.complete.mockResolvedValue('not json at all');
    await expect(useCase.execute(INPUT)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws 500 when LLM JSON missing required fields', async () => {
    llmService.complete.mockResolvedValue(
      JSON.stringify({ level: 'beginner' }),
    );
    await expect(useCase.execute(INPUT)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
