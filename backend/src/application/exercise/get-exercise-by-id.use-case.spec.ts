import { Test } from '@nestjs/testing';
import { GetExerciseByIdUseCase } from './get-exercise-by-id.use-case';
import { Exercise } from '../../domain/exercise/exercise';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';

const mockExercise: Exercise = {
  id: 'ex-1',
  wgerId: 42,
  name: 'Bicep Curl',
  description: 'A curl exercise',
  muscleGroups: ['biceps'],
  equipment: ['barbell'],
  youtubeUrl: null,
  everkineticSlug: null,
  createdAt: new Date('2024-01-01'),
};

describe('GetExerciseByIdUseCase', () => {
  let useCase: GetExerciseByIdUseCase;
  let exerciseRepository: jest.Mocked<ExerciseRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetExerciseByIdUseCase,
        {
          provide: ExerciseRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(GetExerciseByIdUseCase);
    exerciseRepository = module.get(ExerciseRepository);
  });

  it('returns exercise when repository finds it', async () => {
    exerciseRepository.findById.mockResolvedValue(mockExercise);
    const result = await useCase.execute('ex-1');
    expect(exerciseRepository.findById).toHaveBeenCalledWith('ex-1');
    expect(result).toEqual(mockExercise);
  });

  it('returns null when repository finds nothing', async () => {
    exerciseRepository.findById.mockResolvedValue(null);
    const result = await useCase.execute('unknown-id');
    expect(result).toBeNull();
  });
});
