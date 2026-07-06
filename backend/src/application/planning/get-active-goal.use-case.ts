import { Injectable } from '@nestjs/common';
import { Goal } from '../../domain/planning/goal';
import { GoalRepository } from '../../domain/planning/goal.repository';

@Injectable()
export class GetActiveGoalUseCase {
  constructor(private readonly goalRepository: GoalRepository) {}

  async execute(userId: string): Promise<Goal | null> {
    return this.goalRepository.findActiveByUser(userId);
  }
}
