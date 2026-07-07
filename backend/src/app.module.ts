import { join } from 'path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import * as Joi from 'joi';
import { AnalysisModule } from './analysis/analysis.module';
import { AuthModule } from './auth/auth.module';
import { ExecutionModule } from './execution/execution.module';
import { ExerciseModule } from './exercise/exercise.module';
import { HealthModule } from './health/health.module';
import { ExerciseOrmEntity } from './infrastructure/persistence/entities/exercise.orm-entity';
import { GoalOrmEntity } from './infrastructure/persistence/entities/goal.orm-entity';
import { RevokedSessionOrmEntity } from './infrastructure/persistence/entities/revoked-session.orm-entity';
import { SessionAnalysisOrmEntity } from './infrastructure/persistence/entities/session-analysis.orm-entity';
import { SessionExerciseOrmEntity } from './infrastructure/persistence/entities/session-exercise.orm-entity';
import { SessionOrmEntity } from './infrastructure/persistence/entities/session.orm-entity';
import { UserExerciseOrmEntity } from './infrastructure/persistence/entities/user-exercise.orm-entity';
import { UserFitnessProfileOrmEntity } from './infrastructure/persistence/entities/user-fitness-profile.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/entities/user.orm-entity';
import { WorkoutLogOrmEntity } from './infrastructure/persistence/entities/workout-log.orm-entity';
import { PlanningModule } from './planning/planning.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_PATH: Joi.string().default('data/trainer.sqlite'),
        FRONTEND_URL: Joi.string().default('http://localhost:5173'),
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        AUTH_SERVICE_URL: Joi.string().required(),
        AUTH_CLIENT_ID: Joi.string().required(),
        AUTH_CLIENT_SECRET: Joi.string().required(),
        AUTH_WEBHOOK_SECRET: Joi.string().required(),
        OPENAI_API_KEY: Joi.string().required(),
        LLM_PROVIDER: Joi.string().default('openai'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DATABASE_PATH', 'data/trainer.sqlite'),
        entities: [
          UserOrmEntity,
          RevokedSessionOrmEntity,
          ExerciseOrmEntity,
          UserExerciseOrmEntity,
          GoalOrmEntity,
          SessionOrmEntity,
          SessionExerciseOrmEntity,
          WorkoutLogOrmEntity,
          SessionAnalysisOrmEntity,
          UserFitnessProfileOrmEntity,
        ],
        synchronize: true,
      }),
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, 'public'),
            exclude: ['/api/*path'],
          }),
        ]
      : []),
    HealthModule,
    AuthModule,
    ExerciseModule,
    PlanningModule,
    ExecutionModule,
    AnalysisModule,
    ProfileModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}
