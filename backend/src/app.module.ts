import { join } from 'path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { LoggerModule } from 'nestjs-pino';
import { AnalysisModule } from './analysis/analysis.module';
import { AuthModule } from './auth/auth.module';
import { ExecutionModule } from './execution/execution.module';
import { ExerciseModule } from './exercise/exercise.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
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
import { createEnvSchema } from './infrastructure/config/env.schema';
import { loggerParams } from './infrastructure/logging/logger.config';
import { STATIC_EXCLUDE } from './interfaces/http/static-exclude';
import { throttlerOptions } from './interfaces/http/throttling';
import { PlanningModule } from './planning/planning.module';
import { ProfileModule } from './profile/profile.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: createEnvSchema(process.env),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        loggerParams(
          config.get<string>('NODE_ENV'),
          config.getOrThrow<string>('PSEUDONYM_SECRET'),
        ),
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
            exclude: STATIC_EXCLUDE,
          }),
        ]
      : []),
    ThrottlerModule.forRoot(throttlerOptions),
    HealthModule,
    FeatureFlagsModule,
    TelemetryModule,
    AuthModule,
    ExerciseModule,
    PlanningModule,
    ExecutionModule,
    AnalysisModule,
    ProfileModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}
