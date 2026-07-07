import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_fitness_profiles' })
export class UserFitnessProfileOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'user_id', unique: true })
  userId!: string;

  @Column({ type: 'text' })
  level!: string;

  @Column({ type: 'text', name: 'injury_notes' })
  injuryNotes!: string;

  @Column({ type: 'simple-json', name: 'equipment_comfort_list' })
  equipmentComfortList!: string[];

  @Column({ type: 'text', name: 'specific_goal' })
  specificGoal!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'simple-json', name: 'planner_config' })
  plannerConfig!: { maxSetsPerExercise: number; intensityMultiplier: number };

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
