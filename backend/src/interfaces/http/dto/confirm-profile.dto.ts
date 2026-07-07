import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';

class PlannerConfigDto {
  @IsNumber()
  maxSetsPerExercise!: number;

  @IsNumber()
  intensityMultiplier!: number;
}

export class ConfirmProfileDto {
  @IsString()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level!: 'beginner' | 'intermediate' | 'advanced';

  @IsString()
  injuryNotes!: string;

  @IsArray()
  @IsString({ each: true })
  equipmentComfortList!: string[];

  @IsString()
  specificGoal!: string;

  @IsString()
  summary!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PlannerConfigDto)
  plannerConfig!: PlannerConfigDto;
}
