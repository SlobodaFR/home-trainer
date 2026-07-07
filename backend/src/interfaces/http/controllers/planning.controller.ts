import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateGoalUseCase } from '../../../application/planning/create-goal.use-case';
import { DeleteGoalUseCase } from '../../../application/planning/delete-goal.use-case';
import { GetActiveGoalUseCase } from '../../../application/planning/get-active-goal.use-case';
import { GetSessionByIdUseCase } from '../../../application/planning/get-session-by-id.use-case';
import { GetSessionsUseCase } from '../../../application/planning/get-sessions.use-case';
import { ReplanSessionUseCase } from '../../../application/planning/replan-session.use-case';
import { Goal } from '../../../domain/planning/goal';
import { Session } from '../../../domain/planning/session';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { CreateGoalDto } from '../dto/create-goal.dto';

@Controller()
export class PlanningController {
  constructor(
    private readonly createGoalUseCase: CreateGoalUseCase,
    private readonly deleteGoalUseCase: DeleteGoalUseCase,
    private readonly getActiveGoalUseCase: GetActiveGoalUseCase,
    private readonly getSessionsUseCase: GetSessionsUseCase,
    private readonly getSessionByIdUseCase: GetSessionByIdUseCase,
    private readonly replanSessionUseCase: ReplanSessionUseCase,
  ) {}

  @Post('goals')
  async createGoal(
    @Body() dto: CreateGoalDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Goal> {
    const activeFrom = dto.activeFrom ?? new Date().toISOString().slice(0, 10);
    return this.createGoalUseCase.execute(user.id, {
      type: dto.type,
      targetDescription: dto.targetDescription,
      horizonWeeks: dto.horizonWeeks,
      availabilityDays: dto.availabilityDays,
      sessionDurationMinutes: dto.sessionDurationMinutes,
      availableEquipment: dto.availableEquipment,
      activeFrom,
    });
  }

  @Delete('goals/:id')
  @HttpCode(204)
  async deleteGoal(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.deleteGoalUseCase.execute(id, user.id);
  }

  @Get('goals/active')
  async getActiveGoal(@CurrentUser() user: CurrentUserPayload): Promise<Goal> {
    const goal = await this.getActiveGoalUseCase.execute(user.id);
    if (!goal) throw new NotFoundException('No active goal');
    return goal;
  }

  @Get('sessions')
  async getSessions(
    @Query('all') all: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session[]> {
    return this.getSessionsUseCase.execute(
      user.id,
      all !== 'true' ? 'upcoming' : 'all',
    );
  }

  @Get('sessions/:id')
  async getSession(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session> {
    const session = await this.getSessionByIdUseCase.execute(id, user.id);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  @Post('sessions/:id/replan')
  async replanSession(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Session> {
    return this.replanSessionUseCase.execute(id, user.id);
  }
}
