import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../../domain/profile/profile.repository';
import type {
  FitnessProfileDraft,
  UserFitnessProfile,
} from '../../domain/profile/user-fitness-profile';

@Injectable()
export class SaveProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  execute(
    userId: string,
    draft: FitnessProfileDraft,
  ): Promise<UserFitnessProfile> {
    return this.profileRepository.upsert(userId, draft);
  }
}
