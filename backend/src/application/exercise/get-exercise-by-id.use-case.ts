import { Injectable } from '@nestjs/common';
import { Exercise } from '../../domain/exercise/exercise';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';

@Injectable()
export class GetExerciseByIdUseCase {
  constructor(private readonly exerciseRepository: ExerciseRepository) {}

  execute(id: string): Promise<Exercise | null> {
    return this.exerciseRepository.findById(id);
  }
}
