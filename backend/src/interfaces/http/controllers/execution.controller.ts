import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FinishSessionUseCase } from '../../../application/execution/finish-session.use-case';
import { GetSetsUseCase } from '../../../application/execution/get-sets.use-case';
import { LogSetUseCase } from '../../../application/execution/log-set.use-case';
import { PauseSessionUseCase } from '../../../application/execution/pause-session.use-case';
import { ResumeSessionUseCase } from '../../../application/execution/resume-session.use-case';
import { StartSessionUseCase } from '../../../application/execution/start-session.use-case';
import { WorkoutLog } from '../../../domain/execution/workout-log';
import { Session } from '../../../domain/planning/session';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { FinishSessionDto } from '../dto/finish-session.dto';
import { LogSetDto } from '../dto/log-set.dto';

@Controller()
export class ExecutionController {
  constructor(
    private readonly startSessionUseCase: StartSessionUseCase,
    private readonly pauseSessionUseCase: PauseSessionUseCase,
    private readonly resumeSessionUseCase: ResumeSessionUseCase,
    private readonly finishSessionUseCase: FinishSessionUseCase,
    private readonly logSetUseCase: LogSetUseCase,
    private readonly getSetsUseCase: GetSetsUseCase,
  ) {}

  @Post('sessions/:id/start')
  async startSession(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session> {
    return this.startSessionUseCase.execute(id, user.id);
  }

  @Post('sessions/:id/pause')
  async pauseSession(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session> {
    return this.pauseSessionUseCase.execute(id, user.id);
  }

  @Post('sessions/:id/resume')
  async resumeSession(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session> {
    return this.resumeSessionUseCase.execute(id, user.id);
  }

  @Post('sessions/:id/finish')
  async finishSession(
    @Param('id') id: string,
    @Body() dto: FinishSessionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session> {
    return this.finishSessionUseCase.execute(
      id,
      user.id,
      dto.rpe ?? null,
      dto.note ?? null,
    );
  }

  @Post('sessions/:id/sets')
  async logSet(
    @Param('id') id: string,
    @Body() dto: LogSetDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<WorkoutLog> {
    return this.logSetUseCase.execute(id, user.id, {
      sessionExerciseId: dto.sessionExerciseId,
      setNumber: dto.setNumber,
      repsCompleted: dto.repsCompleted ?? null,
      weightKg: dto.weightKg ?? null,
      durationSeconds: dto.durationSeconds ?? null,
    });
  }

  @Get('sessions/:id/sets')
  async getSets(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<WorkoutLog[]> {
    return this.getSetsUseCase.execute(id, user.id);
  }
}
