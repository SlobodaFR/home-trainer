import { Goal } from './goal';

export abstract class GoalRepository {
  abstract findActiveByUser(userId: string): Promise<Goal | null>;
  abstract save(data: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal>;
  abstract deactivateAllForUser(userId: string): Promise<void>;
}
