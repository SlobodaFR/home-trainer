import { Injectable } from '@nestjs/common';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

@Injectable()
export class ToggleFavoriteUseCase {
  constructor(
    private readonly userExerciseRepository: UserExerciseRepository,
  ) {}

  async execute(
    userId: string,
    exerciseId: string,
    isFavorite: boolean,
  ): Promise<boolean> {
    await this.userExerciseRepository.upsertFavorite(
      userId,
      exerciseId,
      isFavorite,
    );
    return isFavorite;
  }
}
