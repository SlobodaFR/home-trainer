import { Test } from '@nestjs/testing';
import { SetPreferenceUseCase } from './set-preference.use-case';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

describe('SetPreferenceUseCase', () => {
  let useCase: SetPreferenceUseCase;
  let userExerciseRepository: jest.Mocked<UserExerciseRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SetPreferenceUseCase,
        {
          provide: UserExerciseRepository,
          useValue: { upsertPreference: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get(SetPreferenceUseCase);
    userExerciseRepository = module.get(UserExerciseRepository);
  });

  it('saves preference weight 3', async () => {
    userExerciseRepository.upsertPreference.mockResolvedValue(undefined);
    await useCase.execute('user-1', 'ex-1', 3);
    expect(userExerciseRepository.upsertPreference).toHaveBeenCalledWith(
      'user-1',
      'ex-1',
      3,
    );
  });

  it('saves preference weight 1', async () => {
    userExerciseRepository.upsertPreference.mockResolvedValue(undefined);
    await useCase.execute('user-1', 'ex-1', 1);
    expect(userExerciseRepository.upsertPreference).toHaveBeenCalledWith(
      'user-1',
      'ex-1',
      1,
    );
  });
});
