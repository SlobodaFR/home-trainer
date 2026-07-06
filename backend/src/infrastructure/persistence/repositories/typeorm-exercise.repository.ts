import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercise } from '../../../domain/exercise/exercise';
import { ExerciseRepository } from '../../../domain/exercise/exercise.repository';
import { ExerciseOrmEntity } from '../entities/exercise.orm-entity';

@Injectable()
export class TypeOrmExerciseRepository extends ExerciseRepository {
  constructor(
    @InjectRepository(ExerciseOrmEntity)
    private readonly repo: Repository<ExerciseOrmEntity>,
  ) {
    super();
  }

  async findAll(params: {
    muscleGroup?: string;
    equipment?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Exercise[]; total: number }> {
    const qb = this.repo.createQueryBuilder('exercise');

    if (params.muscleGroup) {
      qb.andWhere(`exercise.muscle_groups LIKE '%"' || :muscle || '"%'`, {
        muscle: params.muscleGroup,
      });
    }

    if (params.equipment) {
      qb.andWhere(`exercise.equipment LIKE '%"' || :equip || '"%'`, {
        equip: params.equipment,
      });
    }

    qb.skip((params.page - 1) * params.limit).take(params.limit);

    const [entities, total] = await qb.getManyAndCount();

    return { data: entities.map(toExercise), total };
  }

  async findById(id: string): Promise<Exercise | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? toExercise(entity) : null;
  }
}

function toExercise(e: ExerciseOrmEntity): Exercise {
  return {
    id: e.id,
    wgerId: e.wgerId,
    name: e.name,
    description: e.description,
    muscleGroups: e.muscleGroups,
    equipment: e.equipment,
    youtubeUrl: e.youtubeUrl,
    everkineticSlug: e.everkineticSlug,
    createdAt: e.createdAt,
  };
}
