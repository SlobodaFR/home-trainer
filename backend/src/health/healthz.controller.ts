import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { buildInfo } from '../infrastructure/observability/build-info';
import { Public } from '../interfaces/http/decorators/public.decorator';
import {
  RuntimeHealthMonitor,
  RuntimeHealthSample,
} from '../infrastructure/observability/runtime-health.monitor';

/** Internal health check: blocked by Caddy in production, reachable only from the VPS/container. */
@Public()
@ApiExcludeController()
@SkipThrottle()
@Controller('healthz')
export class RuntimeHealthController {
  constructor(private readonly monitor: RuntimeHealthMonitor) {}

  @Get()
  health(): {
    status: 'ok';
    version: string;
    commit: string;
    runtime: RuntimeHealthSample | null;
  } {
    return { status: 'ok', ...buildInfo(), runtime: this.monitor.lastSample };
  }
}
