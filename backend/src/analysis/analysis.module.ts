import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisJobService } from '../application/analysis/analysis-job.service';
import { GetAnalysisUseCase } from '../application/analysis/get-analysis.use-case';
import { PromptBuilderService } from '../application/analysis/prompt-builder.service';
import { RetryAnalysisUseCase } from '../application/analysis/retry-analysis.use-case';
import { LLMService } from '../domain/analysis/llm.service';
import { SessionAnalysisRepository } from '../domain/analysis/session-analysis.repository';
import { WorkoutLogRepository } from '../domain/execution/workout-log.repository';
import { GoalRepository } from '../domain/planning/goal.repository';
import { SessionRepository } from '../domain/planning/session.repository';
import { OpenAILLMService } from '../infrastructure/llm/openai-llm.service';
import { GoalOrmEntity } from '../infrastructure/persistence/entities/goal.orm-entity';
import { SessionAnalysisOrmEntity } from '../infrastructure/persistence/entities/session-analysis.orm-entity';
import { SessionExerciseOrmEntity } from '../infrastructure/persistence/entities/session-exercise.orm-entity';
import { SessionOrmEntity } from '../infrastructure/persistence/entities/session.orm-entity';
import { WorkoutLogOrmEntity } from '../infrastructure/persistence/entities/workout-log.orm-entity';
import { TypeOrmGoalRepository } from '../infrastructure/persistence/repositories/typeorm-goal.repository';
import { TypeOrmSessionAnalysisRepository } from '../infrastructure/persistence/repositories/typeorm-session-analysis.repository';
import { TypeOrmSessionRepository } from '../infrastructure/persistence/repositories/typeorm-session.repository';
import { TypeOrmWorkoutLogRepository } from '../infrastructure/persistence/repositories/typeorm-workout-log.repository';
import { AnalysisController } from '../interfaces/http/controllers/analysis.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SessionAnalysisOrmEntity,
      SessionOrmEntity,
      SessionExerciseOrmEntity,
      GoalOrmEntity,
      WorkoutLogOrmEntity,
    ]),
  ],
  controllers: [AnalysisController],
  providers: [
    GetAnalysisUseCase,
    RetryAnalysisUseCase,
    AnalysisJobService,
    PromptBuilderService,
    {
      provide: SessionAnalysisRepository,
      useClass: TypeOrmSessionAnalysisRepository,
    },
    { provide: SessionRepository, useClass: TypeOrmSessionRepository },
    { provide: GoalRepository, useClass: TypeOrmGoalRepository },
    { provide: WorkoutLogRepository, useClass: TypeOrmWorkoutLogRepository },
    { provide: LLMService, useClass: OpenAILLMService },
  ],
  exports: [AnalysisJobService],
})
export class AnalysisModule {}
