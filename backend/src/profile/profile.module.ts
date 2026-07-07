import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessFitnessUseCase } from '../application/profile/assess-fitness.use-case';
import { GetProfileUseCase } from '../application/profile/get-profile.use-case';
import { SaveProfileUseCase } from '../application/profile/save-profile.use-case';
import { LLMService } from '../domain/analysis/llm.service';
import { ProfileRepository } from '../domain/profile/profile.repository';
import { OpenAILLMService } from '../infrastructure/llm/openai-llm.service';
import { UserFitnessProfileOrmEntity } from '../infrastructure/persistence/entities/user-fitness-profile.orm-entity';
import { TypeOrmProfileRepository } from '../infrastructure/persistence/repositories/typeorm-profile.repository';
import { ProfileController } from '../interfaces/http/controllers/profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserFitnessProfileOrmEntity])],
  controllers: [ProfileController],
  providers: [
    AssessFitnessUseCase,
    SaveProfileUseCase,
    GetProfileUseCase,
    { provide: ProfileRepository, useClass: TypeOrmProfileRepository },
    { provide: LLMService, useClass: OpenAILLMService },
  ],
  exports: [ProfileRepository],
})
export class ProfileModule {}
