import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Telemetry } from '../domain/shared/telemetry';
import { createPostHogTelemetry } from '../infrastructure/telemetry/posthog-telemetry';
import { TelemetryInterceptor } from '../interfaces/http/telemetry.interceptor';

/** Operational telemetry (runtime_health, http_request) to PostHog; NOOP without POSTHOG_API_KEY. */
@Global()
@Module({
  providers: [
    {
      provide: Telemetry,
      useFactory: (config: ConfigService) => createPostHogTelemetry(config),
      inject: [ConfigService],
    },
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
  exports: [Telemetry],
})
export class TelemetryModule {}
