import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../../domain/planning/session';
import { SessionExercise } from '../../../domain/planning/session-exercise';
import {
  NewSession,
  NewSessionExercise,
  SessionRepository,
} from '../../../domain/planning/session.repository';
import { SessionExerciseOrmEntity } from '../entities/session-exercise.orm-entity';
import { SessionOrmEntity } from '../entities/session.orm-entity';

@Injectable()
export class TypeOrmSessionRepository extends SessionRepository {
  constructor(
    @InjectRepository(SessionOrmEntity)
    private readonly sessionRepo: Repository<SessionOrmEntity>,
    @InjectRepository(SessionExerciseOrmEntity)
    private readonly exerciseRepo: Repository<SessionExerciseOrmEntity>,
  ) {
    super();
  }

  async findByUser(userId: string, onlyPlanned: boolean): Promise<Session[]> {
    const entities = await this.sessionRepo.find({
      where: { userId, ...(onlyPlanned ? { status: 'planned' } : {}) },
      order: { plannedDate: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e, []));
  }

  async findById(id: string): Promise<Session | null> {
    const entity = await this.sessionRepo.findOne({
      where: { id },
      relations: { exercises: true },
      order: { exercises: { order: 'ASC' } },
    });
    if (!entity) return null;
    return this.toDomain(entity, entity.exercises);
  }

  async saveAll(sessions: NewSession[]): Promise<void> {
    for (const s of sessions) {
      const sessionEntity = this.sessionRepo.create({
        userId: s.userId,
        goalId: s.goalId,
        plannedDate: s.plannedDate,
        status: 'planned',
      });
      const saved = await this.sessionRepo.save(sessionEntity);
      if (s.exercises.length > 0) {
        const exerciseEntities = s.exercises.map((e) =>
          this.exerciseRepo.create({
            sessionId: saved.id,
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            order: e.order,
            sets: e.sets,
            repsOrDuration: e.repsOrDuration,
          }),
        );
        await this.exerciseRepo.save(exerciseEntities);
      }
    }
  }

  async replaceExercises(
    sessionId: string,
    exercises: NewSessionExercise[],
  ): Promise<Session> {
    await this.exerciseRepo.delete({ sessionId });
    if (exercises.length > 0) {
      const entities = exercises.map((e) =>
        this.exerciseRepo.create({
          sessionId,
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          order: e.order,
          sets: e.sets,
          repsOrDuration: e.repsOrDuration,
        }),
      );
      await this.exerciseRepo.save(entities);
    }
    const updated = await this.findById(sessionId);
    if (!updated)
      throw new Error(`Session ${sessionId} not found after replaceExercises`);
    return updated;
  }

  private toDomain(
    entity: SessionOrmEntity,
    exerciseEntities: SessionExerciseOrmEntity[],
  ): Session {
    return {
      id: entity.id,
      userId: entity.userId,
      goalId: entity.goalId,
      plannedDate: entity.plannedDate,
      status: entity.status as Session['status'],
      createdAt: entity.createdAt,
      exercises: exerciseEntities.map((e): SessionExercise => ({
        id: e.id,
        sessionId: e.sessionId,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        order: e.order,
        sets: e.sets,
        repsOrDuration: e.repsOrDuration,
      })),
    };
  }
}
