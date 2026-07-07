import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'exercises' })
export class ExerciseOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int', name: 'wger_id', unique: true, nullable: true })
  wgerId!: number | null;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'simple-json', name: 'muscle_groups', default: '[]' })
  muscleGroups!: string[];

  @Column({ type: 'simple-json', default: '[]' })
  equipment!: string[];

  @Column({ type: 'text', name: 'image_url', nullable: true, default: null })
  imageUrl!: string | null;

  @Column({ type: 'simple-json', name: 'muscle_images', default: '[]' })
  muscleImages!:
    { url: string; isFront: boolean; isSecondary: boolean }[] | null;

  @Column({ type: 'text', name: 'youtube_url', nullable: true })
  youtubeUrl!: string | null;

  @Column({ type: 'text', name: 'everkinetic_slug', nullable: true })
  everkineticSlug!: string | null;

  @Column({ type: 'text', name: 'name_fr', nullable: true, default: null })
  nameFr!: string | null;

  @Column({
    type: 'text',
    name: 'description_fr',
    nullable: true,
    default: null,
  })
  descriptionFr!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
