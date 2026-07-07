import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileRepository } from '../../../domain/profile/profile.repository';
import type {
  FitnessProfileDraft,
  UserFitnessProfile,
} from '../../../domain/profile/user-fitness-profile';
import { UserFitnessProfileOrmEntity } from '../entities/user-fitness-profile.orm-entity';

@Injectable()
export class TypeOrmProfileRepository extends ProfileRepository {
  constructor(
    @InjectRepository(UserFitnessProfileOrmEntity)
    private readonly repo: Repository<UserFitnessProfileOrmEntity>,
  ) {
    super();
  }

  async findByUser(userId: string): Promise<UserFitnessProfile | null> {
    const entity = await this.repo.findOne({ where: { userId } });
    return entity ? this.toDomain(entity) : null;
  }

  async upsert(
    userId: string,
    draft: FitnessProfileDraft,
  ): Promise<UserFitnessProfile> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) {
      existing.level = draft.level;
      existing.injuryNotes = draft.injuryNotes;
      existing.equipmentComfortList = draft.equipmentComfortList;
      existing.specificGoal = draft.specificGoal;
      existing.summary = draft.summary;
      existing.plannerConfig = draft.plannerConfig;
      const saved = await this.repo.save(existing);
      return this.toDomain(saved);
    }
    const created = this.repo.create({ userId, ...draft });
    const saved = await this.repo.save(created);
    return this.toDomain(saved);
  }

  private toDomain(entity: UserFitnessProfileOrmEntity): UserFitnessProfile {
    return {
      id: entity.id,
      userId: entity.userId,
      level: entity.level as UserFitnessProfile['level'],
      injuryNotes: entity.injuryNotes,
      equipmentComfortList: entity.equipmentComfortList,
      specificGoal: entity.specificGoal,
      summary: entity.summary,
      plannerConfig: entity.plannerConfig,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
