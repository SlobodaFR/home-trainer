import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AssessFitnessDto {
  @IsString()
  @IsIn(['débutant', 'intermédiaire', 'avancé'])
  experience!: 'débutant' | 'intermédiaire' | 'avancé';

  @IsNumber()
  @Min(0)
  @Max(50)
  yearsTraining!: number;

  @IsArray()
  @IsString({ each: true })
  injuries!: string[];

  @IsString()
  @IsOptional()
  injuryNote!: string;

  @IsArray()
  @IsString({ each: true })
  equipmentComfort!: string[];

  @IsString()
  @MaxLength(300)
  specificGoal!: string;
}
