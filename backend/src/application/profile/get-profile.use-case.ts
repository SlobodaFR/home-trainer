import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../../domain/profile/profile.repository';
import type { UserFitnessProfile } from '../../domain/profile/user-fitness-profile';

@Injectable()
export class GetProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  execute(userId: string): Promise<UserFitnessProfile | null> {
    return this.profileRepository.findByUser(userId);
  }
}
