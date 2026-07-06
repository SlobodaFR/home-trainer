import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'workout_logs' })
export class WorkoutLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'text', name: 'session_exercise_id' })
  sessionExerciseId!: string;

  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'integer', name: 'set_number' })
  setNumber!: number;

  @Column({ type: 'integer', name: 'reps_completed', nullable: true })
  repsCompleted!: number | null;

  @Column({ type: 'real', name: 'weight_kg', nullable: true })
  weightKg!: number | null;

  @Column({ type: 'integer', name: 'duration_seconds', nullable: true })
  durationSeconds!: number | null;

  @CreateDateColumn({ type: 'datetime', name: 'completed_at' })
  completedAt!: Date;
}
