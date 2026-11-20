import { Module } from '@nestjs/common';
import { RuntimeHealthMonitor } from '../infrastructure/observability/runtime-health.monitor';
import { HealthController } from './health.controller';
import { RuntimeHealthController } from './healthz.controller';

@Module({
  controllers: [HealthController, RuntimeHealthController],
  providers: [RuntimeHealthMonitor],
})
export class HealthModule {}
