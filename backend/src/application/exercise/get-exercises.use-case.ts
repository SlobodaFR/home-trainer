import { Injectable } from '@nestjs/common';
import { ExerciseWithPreference } from '../../domain/exercise/exercise-with-preference';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExercise } from '../../domain/exercise/user-exercise';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

export interface GetExercisesParams {
  userId: string;
  muscleGroup?: string;
  equipment?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedExercises {
  data: ExerciseWithPreference[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class GetExercisesUseCase {
  constructor(
    private readonly exerciseRepository: ExerciseRepository,
    private readonly userExerciseRepository: UserExerciseRepository,
  ) {}

  async execute(params: GetExercisesParams): Promise<PaginatedExercises> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);

    const { data, total } = await this.exerciseRepository.findAll({
      muscleGroup: params.muscleGroup,
      equipment: params.equipment,
      page,
      limit,
    });

    const userExercises = await this.userExerciseRepository.findByUser(
      params.userId,
    );
    const ueMap = new Map<string, UserExercise>(
      userExercises.map((ue) => [ue.exerciseId, ue]),
    );

    const enriched: ExerciseWithPreference[] = data.map((exercise) => {
      const ue = ueMap.get(exercise.id);
      return {
        ...exercise,
        isFavorite: ue?.isFavorite ?? false,
        preferenceWeight: ue?.preferenceWeight ?? null,
      };
    });

    return { data: enriched, total, page, limit };
  }
}
