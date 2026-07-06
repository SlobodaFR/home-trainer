import { Test } from '@nestjs/testing';
import { ToggleFavoriteUseCase } from './toggle-favorite.use-case';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

describe('ToggleFavoriteUseCase', () => {
  let useCase: ToggleFavoriteUseCase;
  let userExerciseRepository: jest.Mocked<UserExerciseRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ToggleFavoriteUseCase,
        {
          provide: UserExerciseRepository,
          useValue: { upsertFavorite: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get(ToggleFavoriteUseCase);
    userExerciseRepository = module.get(UserExerciseRepository);
  });

  it('sets isFavorite to true and returns true', async () => {
    userExerciseRepository.upsertFavorite.mockResolvedValue(undefined);
    const result = await useCase.execute('user-1', 'ex-1', true);
    expect(userExerciseRepository.upsertFavorite).toHaveBeenCalledWith(
      'user-1',
      'ex-1',
      true,
    );
    expect(result).toBe(true);
  });

  it('sets isFavorite to false and returns false', async () => {
    userExerciseRepository.upsertFavorite.mockResolvedValue(undefined);
    const result = await useCase.execute('user-1', 'ex-1', false);
    expect(userExerciseRepository.upsertFavorite).toHaveBeenCalledWith(
      'user-1',
      'ex-1',
      false,
    );
    expect(result).toBe(false);
  });
});
