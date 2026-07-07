import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'session_analyses' })
export class SessionAnalysisOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'session_id', unique: true })
  sessionId!: string;

  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ type: 'text', nullable: true, default: null })
  result!: string | null;

  @Column({ type: 'integer', name: 'retry_count', default: 0 })
  retryCount!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
