import { join } from 'path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { LoggerModule } from 'nestjs-pino';
import { AnalysisModule } from './analysis/analysis.module';
import { AuthModule } from './auth/auth.module';
import { ExecutionModule } from './execution/execution.module';
import { ExerciseModule } from './exercise/exercise.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './infrastructure/persistence/database.module';
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
    DatabaseModule,
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
