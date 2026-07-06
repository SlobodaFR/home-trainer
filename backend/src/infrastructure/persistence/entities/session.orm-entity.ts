import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SessionExerciseOrmEntity } from './session-exercise.orm-entity';

@Entity({ name: 'sessions' })
export class SessionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', name: 'goal_id' })
  goalId!: string;

  @Column({ type: 'text', name: 'planned_date' })
  plannedDate!: string;

  @Column({ type: 'text', default: 'planned' })
  status!: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => SessionExerciseOrmEntity, (se) => se.session, {
    cascade: true,
  })
  exercises!: SessionExerciseOrmEntity[];
}
