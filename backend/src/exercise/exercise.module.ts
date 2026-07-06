import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetExerciseByIdUseCase } from '../application/exercise/get-exercise-by-id.use-case';
import { GetExercisesUseCase } from '../application/exercise/get-exercises.use-case';
import { ExerciseRepository } from '../domain/exercise/exercise.repository';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';
import { TypeOrmExerciseRepository } from '../infrastructure/persistence/repositories/typeorm-exercise.repository';
import { ExerciseController } from '../interfaces/http/controllers/exercise.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseOrmEntity])],
  controllers: [ExerciseController],
  providers: [
    GetExercisesUseCase,
    GetExerciseByIdUseCase,
    { provide: ExerciseRepository, useClass: TypeOrmExerciseRepository },
  ],
})
export class ExerciseModule {}
