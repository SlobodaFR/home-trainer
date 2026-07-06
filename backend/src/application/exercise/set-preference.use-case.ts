import { Injectable } from '@nestjs/common';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';

@Injectable()
export class SetPreferenceUseCase {
  constructor(
    private readonly userExerciseRepository: UserExerciseRepository,
  ) {}

  async execute(
    userId: string,
    exerciseId: string,
    weight: number,
  ): Promise<void> {
    await this.userExerciseRepository.upsertPreference(
      userId,
      exerciseId,
      weight,
    );
  }
}
