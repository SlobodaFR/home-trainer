import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinishSessionUseCase } from '../application/execution/finish-session.use-case';
import { GetSetsUseCase } from '../application/execution/get-sets.use-case';
import { LogSetUseCase } from '../application/execution/log-set.use-case';
import { PauseSessionUseCase } from '../application/execution/pause-session.use-case';
import { ResumeSessionUseCase } from '../application/execution/resume-session.use-case';
import { StartSessionUseCase } from '../application/execution/start-session.use-case';
import { WorkoutLogRepository } from '../domain/execution/workout-log.repository';
import { SessionRepository } from '../domain/planning/session.repository';
import { SessionExerciseOrmEntity } from '../infrastructure/persistence/entities/session-exercise.orm-entity';
import { SessionOrmEntity } from '../infrastructure/persistence/entities/session.orm-entity';
import { WorkoutLogOrmEntity } from '../infrastructure/persistence/entities/workout-log.orm-entity';
import { TypeOrmSessionRepository } from '../infrastructure/persistence/repositories/typeorm-session.repository';
import { TypeOrmWorkoutLogRepository } from '../infrastructure/persistence/repositories/typeorm-workout-log.repository';
import { ExecutionController } from '../interfaces/http/controllers/execution.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SessionOrmEntity,
      SessionExerciseOrmEntity,
      WorkoutLogOrmEntity,
    ]),
  ],
  controllers: [ExecutionController],
  providers: [
    StartSessionUseCase,
    PauseSessionUseCase,
    ResumeSessionUseCase,
    FinishSessionUseCase,
    LogSetUseCase,
    GetSetsUseCase,
    { provide: SessionRepository, useClass: TypeOrmSessionRepository },
    { provide: WorkoutLogRepository, useClass: TypeOrmWorkoutLogRepository },
  ],
})
export class ExecutionModule {}
