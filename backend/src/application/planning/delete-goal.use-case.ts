import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { SessionRepository } from '../../domain/planning/session.repository';

@Injectable()
export class DeleteGoalUseCase {
  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(goalId: string, userId: string): Promise<void> {
    const goal = await this.goalRepository.findActiveByUser(userId);
    if (goal?.id !== goalId) throw new NotFoundException('Goal not found');
    await this.sessionRepository.deleteByGoalId(goalId);
    await this.goalRepository.delete(goalId, userId);
  }
}
