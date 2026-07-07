import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExerciseController } from './exercise.controller';
import { GetExerciseByIdUseCase } from '../../../application/exercise/get-exercise-by-id.use-case';
import {
  GetExercisesUseCase,
  PaginatedExercises,
} from '../../../application/exercise/get-exercises.use-case';
import { SetPreferenceUseCase } from '../../../application/exercise/set-preference.use-case';
import { ToggleFavoriteUseCase } from '../../../application/exercise/toggle-favorite.use-case';
import { ExerciseWithPreference } from '../../../domain/exercise/exercise-with-preference';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { ListExercisesDto } from '../dto/list-exercises.dto';
import { SetPreferenceDto } from '../dto/set-preference.dto';

const mockUser: CurrentUserPayload = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
};

const mockExercise: ExerciseWithPreference = {
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
  isFavorite: false,
  preferenceWeight: null,
};

describe('ExerciseController', () => {
  let controller: ExerciseController;
  let getExercises: jest.Mocked<GetExercisesUseCase>;
  let getExerciseById: jest.Mocked<GetExerciseByIdUseCase>;
  let toggleFavorite: jest.Mocked<ToggleFavoriteUseCase>;
  let setPreference: jest.Mocked<SetPreferenceUseCase>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExerciseController],
      providers: [
        {
          provide: GetExercisesUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetExerciseByIdUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ToggleFavoriteUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: SetPreferenceUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(ExerciseController);
    getExercises = module.get(GetExercisesUseCase);
    getExerciseById = module.get(GetExerciseByIdUseCase);
    toggleFavorite = module.get(ToggleFavoriteUseCase);
    setPreference = module.get(SetPreferenceUseCase);
  });

  describe('list', () => {
    it('returns paginated result from use case', async () => {
      const paginated: PaginatedExercises = {
        data: [mockExercise],
        total: 1,
        page: 1,
        limit: 20,
      };
      getExercises.execute.mockResolvedValue(paginated);

      const query = new ListExercisesDto();
      const result = await controller.list(query, mockUser);

      expect(result).toEqual(paginated);
    });

    it('passes muscleGroup and userId to use case', async () => {
      getExercises.execute.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      const query = Object.assign(new ListExercisesDto(), {
        muscleGroup: 'biceps',
      });
      await controller.list(query, mockUser);
      expect(getExercises.execute).toHaveBeenCalledWith(
        expect.objectContaining({ muscleGroup: 'biceps', userId: 'user-1' }),
      );
    });
  });

  describe('detail', () => {
    it('returns exercise when found', async () => {
      getExerciseById.execute.mockResolvedValue(mockExercise);
      const result = await controller.detail('ex-1', mockUser);
      expect(result).toEqual(mockExercise);
    });

    it('throws NotFoundException when exercise not found', async () => {
      getExerciseById.execute.mockResolvedValue(null);
      await expect(controller.detail('unknown', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markFavorite', () => {
    it('returns isFavorite: true', async () => {
      toggleFavorite.execute.mockResolvedValue(true);
      const result = await controller.markFavorite('ex-1', mockUser);
      expect(toggleFavorite.execute).toHaveBeenCalledWith(
        'user-1',
        'ex-1',
        true,
      );
      expect(result).toEqual({ isFavorite: true });
    });
  });

  describe('removeFavorite', () => {
    it('returns isFavorite: false', async () => {
      toggleFavorite.execute.mockResolvedValue(false);
      const result = await controller.removeFavorite('ex-1', mockUser);
      expect(toggleFavorite.execute).toHaveBeenCalledWith(
        'user-1',
        'ex-1',
        false,
      );
      expect(result).toEqual({ isFavorite: false });
    });
  });

  describe('setExercisePreference', () => {
    it('calls setPreference use case with weight', async () => {
      setPreference.execute.mockResolvedValue(undefined);
      const dto = Object.assign(new SetPreferenceDto(), { weight: 3 });
      await controller.setExercisePreference('ex-1', dto, mockUser);
      expect(setPreference.execute).toHaveBeenCalledWith('user-1', 'ex-1', 3);
    });
  });
});
