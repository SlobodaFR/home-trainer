import { Injectable } from '@nestjs/common';
import { Exercise } from '../../domain/exercise/exercise';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';

export interface GetExercisesParams {
  muscleGroup?: string;
  equipment?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedExercises {
  data: Exercise[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class GetExercisesUseCase {
  constructor(private readonly exerciseRepository: ExerciseRepository) {}

  async execute(params: GetExercisesParams): Promise<PaginatedExercises> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);

    const { data, total } = await this.exerciseRepository.findAll({
      muscleGroup: params.muscleGroup,
      equipment: params.equipment,
      page,
      limit,
    });

    return { data, total, page, limit };
  }
}
