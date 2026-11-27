import { Module } from '@nestjs/common';
import { RuntimeHealthMonitor } from '../infrastructure/observability/runtime-health.monitor';
import { HealthController } from './health.controller';
import { RuntimeHealthController } from './healthz.controller';
import { VersionController } from '../interfaces/http/controllers/version.controller';

@Module({
  controllers: [HealthController, RuntimeHealthController, VersionController],
  providers: [RuntimeHealthMonitor],
})
export class HealthModule {}
