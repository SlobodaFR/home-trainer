import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_exercises' })
export class UserExerciseOrmEntity {
  @PrimaryColumn({ type: 'text', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'text', name: 'exercise_id' })
  exerciseId!: string;

  @Column({ type: 'integer', default: 0, name: 'is_favorite' })
  isFavorite!: number;

  @Column({ type: 'integer', nullable: true, name: 'preference_weight' })
  preferenceWeight!: number | null;
}
