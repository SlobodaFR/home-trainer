import { IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class LogSetDto {
  @IsUUID()
  sessionExerciseId!: string;

  @IsInt()
  @Min(1)
  setNumber!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  repsCompleted?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}
