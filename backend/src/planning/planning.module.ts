import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateGoalUseCase } from '../application/planning/create-goal.use-case';
import { DeleteGoalUseCase } from '../application/planning/delete-goal.use-case';
import { GetActiveGoalUseCase } from '../application/planning/get-active-goal.use-case';
import { GetSessionByIdUseCase } from '../application/planning/get-session-by-id.use-case';
import { GetSessionsUseCase } from '../application/planning/get-sessions.use-case';
import { PlannerService } from '../application/planning/planner.service';
import { ReplanSessionUseCase } from '../application/planning/replan-session.use-case';
import { ExerciseRepository } from '../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../domain/exercise/user-exercise.repository';
import { GoalRepository } from '../domain/planning/goal.repository';
import { SessionRepository } from '../domain/planning/session.repository';
import { ExerciseOrmEntity } from '../infrastructure/persistence/entities/exercise.orm-entity';
import { GoalOrmEntity } from '../infrastructure/persistence/entities/goal.orm-entity';
import { SessionExerciseOrmEntity } from '../infrastructure/persistence/entities/session-exercise.orm-entity';
import { SessionOrmEntity } from '../infrastructure/persistence/entities/session.orm-entity';
import { UserExerciseOrmEntity } from '../infrastructure/persistence/entities/user-exercise.orm-entity';
import { TypeOrmExerciseRepository } from '../infrastructure/persistence/repositories/typeorm-exercise.repository';
import { TypeOrmGoalRepository } from '../infrastructure/persistence/repositories/typeorm-goal.repository';
import { TypeOrmSessionRepository } from '../infrastructure/persistence/repositories/typeorm-session.repository';
import { TypeOrmUserExerciseRepository } from '../infrastructure/persistence/repositories/typeorm-user-exercise.repository';
import { PlanningController } from '../interfaces/http/controllers/planning.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoalOrmEntity,
      SessionOrmEntity,
      SessionExerciseOrmEntity,
      ExerciseOrmEntity,
      UserExerciseOrmEntity,
    ]),
  ],
  controllers: [PlanningController],
  providers: [
    PlannerService,
    CreateGoalUseCase,
    DeleteGoalUseCase,
    GetActiveGoalUseCase,
    GetSessionsUseCase,
    GetSessionByIdUseCase,
    ReplanSessionUseCase,
    { provide: GoalRepository, useClass: TypeOrmGoalRepository },
    { provide: SessionRepository, useClass: TypeOrmSessionRepository },
    { provide: ExerciseRepository, useClass: TypeOrmExerciseRepository },
    {
      provide: UserExerciseRepository,
      useClass: TypeOrmUserExerciseRepository,
    },
  ],
})
export class PlanningModule {}
