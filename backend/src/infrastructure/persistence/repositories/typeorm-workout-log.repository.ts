import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkoutLog } from '../../../domain/execution/workout-log';
import { WorkoutLogRepository } from '../../../domain/execution/workout-log.repository';
import { WorkoutLogOrmEntity } from '../entities/workout-log.orm-entity';

@Injectable()
export class TypeOrmWorkoutLogRepository extends WorkoutLogRepository {
  constructor(
    @InjectRepository(WorkoutLogOrmEntity)
    private readonly repo: Repository<WorkoutLogOrmEntity>,
  ) {
    super();
  }

  async findBySession(sessionId: string): Promise<WorkoutLog[]> {
    const entities = await this.repo.find({
      where: { sessionId },
      order: { completedAt: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async save(
    data: Omit<WorkoutLog, 'id' | 'completedAt'>,
  ): Promise<WorkoutLog> {
    const entity = this.repo.create({ ...data });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  private toDomain(entity: WorkoutLogOrmEntity): WorkoutLog {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      sessionExerciseId: entity.sessionExerciseId,
      userId: entity.userId,
      setNumber: entity.setNumber,
      repsCompleted: entity.repsCompleted,
      weightKg: entity.weightKg,
      durationSeconds: entity.durationSeconds,
      completedAt: entity.completedAt,
    };
  }
}
