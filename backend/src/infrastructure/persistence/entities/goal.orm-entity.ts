import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'goals' })
export class GoalOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text', name: 'target_description' })
  targetDescription!: string;

  @Column({ type: 'integer', name: 'horizon_weeks' })
  horizonWeeks!: number;

  @Column({ type: 'simple-json', name: 'availability_days' })
  availabilityDays!: number[];

  @Column({ type: 'integer', name: 'session_duration_minutes' })
  sessionDurationMinutes!: number;

  @Column({ type: 'simple-json', name: 'available_equipment' })
  availableEquipment!: string[];

  @Column({ type: 'text', name: 'active_from' })
  activeFrom!: string;

  @Column({ type: 'integer', name: 'is_active', default: 0 })
  isActive!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
