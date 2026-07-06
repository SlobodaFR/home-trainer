import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SessionOrmEntity } from './session.orm-entity';

@Entity({ name: 'session_exercises' })
export class SessionExerciseOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'text', name: 'exercise_id' })
  exerciseId!: string;

  @Column({ type: 'text', name: 'exercise_name' })
  exerciseName!: string;

  @Column({ type: 'integer' })
  order!: number;

  @Column({ type: 'integer' })
  sets!: number;

  @Column({ type: 'text', name: 'reps_or_duration' })
  repsOrDuration!: string;

  @ManyToOne(() => SessionOrmEntity, (s) => s.exercises)
  @JoinColumn({ name: 'session_id' })
  session!: SessionOrmEntity;
}
