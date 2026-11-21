import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
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
  health(): { status: 'ok'; runtime: RuntimeHealthSample | null } {
    return { status: 'ok', runtime: this.monitor.lastSample };
  }
}
