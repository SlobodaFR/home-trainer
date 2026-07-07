import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../../../domain/planning/goal';
import { GoalRepository } from '../../../domain/planning/goal.repository';
import { GoalOrmEntity } from '../entities/goal.orm-entity';

@Injectable()
export class TypeOrmGoalRepository extends GoalRepository {
  constructor(
    @InjectRepository(GoalOrmEntity)
    private readonly repo: Repository<GoalOrmEntity>,
  ) {
    super();
  }

  async findActiveByUser(userId: string): Promise<Goal | null> {
    const entity = await this.repo.findOneBy({ userId, isActive: 1 });
    return entity ? this.toDomain(entity) : null;
  }

  async save(data: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
    const entity = this.repo.create({
      userId: data.userId,
      type: data.type,
      targetDescription: data.targetDescription,
      horizonWeeks: data.horizonWeeks,
      availabilityDays: data.availabilityDays,
      sessionDurationMinutes: data.sessionDurationMinutes,
      availableEquipment: data.availableEquipment,
      activeFrom: data.activeFrom,
      isActive: data.isActive ? 1 : 0,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async deactivateAllForUser(userId: string): Promise<void> {
    await this.repo.update({ userId }, { isActive: 0 });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  private toDomain(entity: GoalOrmEntity): Goal {
    return {
      id: entity.id,
      userId: entity.userId,
      type: entity.type as Goal['type'],
      targetDescription: entity.targetDescription,
      horizonWeeks: entity.horizonWeeks,
      availabilityDays: entity.availabilityDays,
      sessionDurationMinutes: entity.sessionDurationMinutes,
      availableEquipment: entity.availableEquipment,
      activeFrom: entity.activeFrom,
      isActive: entity.isActive === 1,
      createdAt: entity.createdAt,
    };
  }
}
