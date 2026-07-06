import { Injectable } from '@nestjs/common';
import { ExerciseWithPreference } from '../../domain/exercise/exercise-with-preference';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

@Injectable()
export class GetExerciseByIdUseCase {
  constructor(
    private readonly exerciseRepository: ExerciseRepository,
    private readonly userExerciseRepository: UserExerciseRepository,
  ) {}

  async execute(
    id: string,
    userId: string,
  ): Promise<ExerciseWithPreference | null> {
    const exercise = await this.exerciseRepository.findById(id);
    if (!exercise) return null;

    const ue = await this.userExerciseRepository.findByUserAndExercise(
      userId,
      id,
    );
    return {
      ...exercise,
      isFavorite: ue?.isFavorite ?? false,
      preferenceWeight: ue?.preferenceWeight ?? null,
    };
  }
}
