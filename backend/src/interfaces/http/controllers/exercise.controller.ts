import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { GetExerciseByIdUseCase } from '../../../application/exercise/get-exercise-by-id.use-case';
import { GetExercisesUseCase } from '../../../application/exercise/get-exercises.use-case';
import { Exercise } from '../../../domain/exercise/exercise';
import { ListExercisesDto } from '../dto/list-exercises.dto';

@Controller('exercises')
export class ExerciseController {
  constructor(
    private readonly getExercises: GetExercisesUseCase,
    private readonly getExerciseById: GetExerciseByIdUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListExercisesDto) {
    return this.getExercises.execute(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<Exercise> {
    const exercise = await this.getExerciseById.execute(id);
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }
}
