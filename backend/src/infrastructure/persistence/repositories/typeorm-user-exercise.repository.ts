import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserExercise } from '../../../domain/exercise/user-exercise';
import { UserExerciseRepository } from '../../../domain/exercise/user-exercise.repository';
import { UserExerciseOrmEntity } from '../entities/user-exercise.orm-entity';

@Injectable()
export class TypeOrmUserExerciseRepository extends UserExerciseRepository {
  constructor(
    @InjectRepository(UserExerciseOrmEntity)
    private readonly repo: Repository<UserExerciseOrmEntity>,
  ) {
    super();
  }

  async findByUser(userId: string): Promise<UserExercise[]> {
    const entities = await this.repo.findBy({ userId });
    return entities.map((e) => this.toDomain(e));
  }

  async findByUserAndExercise(
    userId: string,
    exerciseId: string,
  ): Promise<UserExercise | null> {
    const entity = await this.repo.findOneBy({ userId, exerciseId });
    return entity ? this.toDomain(entity) : null;
  }

  async upsertFavorite(
    userId: string,
    exerciseId: string,
    isFavorite: boolean,
  ): Promise<void> {
    let entity = await this.repo.findOneBy({ userId, exerciseId });
    entity ??= this.repo.create({
      userId,
      exerciseId,
      isFavorite: 0,
      preferenceWeight: null,
    });
    entity.isFavorite = isFavorite ? 1 : 0;
    await this.repo.save(entity);
  }

  async upsertPreference(
    userId: string,
    exerciseId: string,
    weight: number,
  ): Promise<void> {
    let entity = await this.repo.findOneBy({ userId, exerciseId });
    entity ??= this.repo.create({
      userId,
      exerciseId,
      isFavorite: 0,
      preferenceWeight: null,
    });
    entity.preferenceWeight = weight;
    await this.repo.save(entity);
  }

  private toDomain(entity: UserExerciseOrmEntity): UserExercise {
    return {
      userId: entity.userId,
      exerciseId: entity.exerciseId,
      isFavorite: entity.isFavorite === 1,
      preferenceWeight: entity.preferenceWeight,
    };
  }
}
