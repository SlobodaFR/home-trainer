import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'revoked_sessions' })
export class RevokedSessionOrmEntity {
  @PrimaryColumn({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'timestamptz', name: 'revoked_at' })
  revokedAt!: Date;
}
