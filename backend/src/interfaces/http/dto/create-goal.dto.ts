import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGoalDto {
  @IsIn(['strength', 'mobility', 'endurance', 'general'])
  type!: 'strength' | 'mobility' | 'endurance' | 'general';

  @IsString()
  @MaxLength(500)
  targetDescription!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  horizonWeeks!: number;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMinSize(1)
  availabilityDays!: number[];

  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(120)
  sessionDurationMinutes!: number;

  @IsArray()
  @IsString({ each: true })
  availableEquipment!: string[];

  @IsOptional()
  @IsDateString()
  activeFrom?: string;
}
