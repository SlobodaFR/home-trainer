import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DataSource } from 'typeorm';

interface HealthResponse {
  status: 'ok';
  db: 'ok' | 'error';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check — API and database status' })
  async check(@Res() res: Response): Promise<void> {
    const body: HealthResponse = { status: 'ok', db: 'ok' };

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      body.db = 'error';
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(body);
      return;
    }

    res.status(HttpStatus.OK).json(body);
  }
}
