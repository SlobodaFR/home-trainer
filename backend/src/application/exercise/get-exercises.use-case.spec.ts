import { Test } from '@nestjs/testing';
import { GetExercisesUseCase } from './get-exercises.use-case';
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

describe('GetExercisesUseCase', () => {
  let useCase: GetExercisesUseCase;
  let exerciseRepository: jest.Mocked<ExerciseRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetExercisesUseCase,
        {
          provide: ExerciseRepository,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue({ data: [mockExercise], total: 1 }),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(GetExercisesUseCase);
    exerciseRepository = module.get(ExerciseRepository);
  });

  it('calls findAll with default page and limit when none provided', async () => {
    const result = await useCase.execute({});
    expect(exerciseRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      muscleGroup: undefined,
      equipment: undefined,
    });
    expect(result).toEqual({
      data: [mockExercise],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('passes muscleGroup filter through to repository', async () => {
    await useCase.execute({ muscleGroup: 'biceps' });
    expect(exerciseRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ muscleGroup: 'biceps' }),
    );
  });

  it('passes equipment filter through to repository', async () => {
    await useCase.execute({ equipment: 'barbell' });
    expect(exerciseRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ equipment: 'barbell' }),
    );
  });

  it('clamps limit to 100 when value exceeds maximum', async () => {
    await useCase.execute({ limit: 150 });
    expect(exerciseRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });
});
