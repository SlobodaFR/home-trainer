import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetExerciseByIdUseCase } from '../application/exercise/get-exercise-by-id.use-case';
import { GetExercisesUseCase } from '../application/exercise/get-exercises.use-case';
import { SetPreferenceUseCase } from '../application/exercise/set-preference.use-case';
import { ToggleFavoriteUseCase } from '../application/exercise/toggle-favorite.use-case';
import { ExerciseRepository } from '../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../domain/exercise/user-exercise.repository';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';
import { UserExerciseOrmEntity } from '../infrastructure/persistence/entities/user-exercise.orm-entity';
import { TypeOrmExerciseRepository } from '../infrastructure/persistence/repositories/typeorm-exercise.repository';
import { TypeOrmUserExerciseRepository } from '../infrastructure/persistence/repositories/typeorm-user-exercise.repository';
import { ExerciseController } from '../interfaces/http/controllers/exercise.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExerciseOrmEntity, UserExerciseOrmEntity]),
  ],
  controllers: [ExerciseController],
  providers: [
    GetExercisesUseCase,
    GetExerciseByIdUseCase,
    ToggleFavoriteUseCase,
    SetPreferenceUseCase,
    { provide: ExerciseRepository, useClass: TypeOrmExerciseRepository },
    {
      provide: UserExerciseRepository,
      useClass: TypeOrmUserExerciseRepository,
    },
  ],
})
export class ExerciseModule {}
