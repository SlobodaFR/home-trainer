import { Test } from '@nestjs/testing';
import { GetExerciseByIdUseCase } from './get-exercise-by-id.use-case';
import { Exercise } from '../../domain/exercise/exercise';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

const mockExercise: Exercise = {
  id: 'ex-1',
  wgerId: 42,
  name: 'Bicep Curl',
  description: 'A curl exercise',
  muscleGroups: ['biceps'],
  equipment: ['barbell'],
  imageUrl: null,
  muscleImages: [],
  youtubeUrl: null,
  everkineticSlug: null,
  createdAt: new Date('2024-01-01'),
};

describe('GetExerciseByIdUseCase', () => {
  let useCase: GetExerciseByIdUseCase;
  let exerciseRepository: jest.Mocked<ExerciseRepository>;
  let userExerciseRepository: jest.Mocked<UserExerciseRepository>;

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
        {
          provide: UserExerciseRepository,
          useValue: {
            findByUserAndExercise: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    useCase = module.get(GetExerciseByIdUseCase);
    exerciseRepository = module.get(ExerciseRepository);
    userExerciseRepository = module.get(UserExerciseRepository);
  });

  it('returns enriched exercise with defaults when no user preference exists', async () => {
    exerciseRepository.findById.mockResolvedValue(mockExercise);
    const result = await useCase.execute('ex-1', 'user-1');
    expect(exerciseRepository.findById).toHaveBeenCalledWith('ex-1');
    expect(result).toEqual({
      ...mockExercise,
      isFavorite: false,
      preferenceWeight: null,
    });
  });

  it('returns null when exercise not found', async () => {
    exerciseRepository.findById.mockResolvedValue(null);
    const result = await useCase.execute('unknown-id', 'user-1');
    expect(result).toBeNull();
  });

  it('returns enriched exercise with user preference data', async () => {
    exerciseRepository.findById.mockResolvedValue(mockExercise);
    userExerciseRepository.findByUserAndExercise.mockResolvedValue({
      userId: 'user-1',
      exerciseId: 'ex-1',
      isFavorite: true,
      preferenceWeight: 3,
    });
    const result = await useCase.execute('ex-1', 'user-1');
    expect(result).toMatchObject({ isFavorite: true, preferenceWeight: 3 });
  });
});
