import type {
  FitnessProfileDraft,
  UserFitnessProfile,
} from './user-fitness-profile';

export abstract class ProfileRepository {
  abstract findByUser(userId: string): Promise<UserFitnessProfile | null>;
  abstract upsert(
    userId: string,
    draft: FitnessProfileDraft,
  ): Promise<UserFitnessProfile>;
}
