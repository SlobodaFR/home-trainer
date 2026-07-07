import { Injectable } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { ExerciseWithPreference } from '../../domain/exercise/exercise-with-preference';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';
import { Goal } from '../../domain/planning/goal';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { SessionRepository } from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';

@Injectable()
export class CreateGoalUseCase {
  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly exerciseRepository: ExerciseRepository,
    private readonly userExerciseRepository: UserExerciseRepository,
    private readonly plannerService: PlannerService,
    private readonly profileRepository: ProfileRepository,
  ) {}

  async execute(
    userId: string,
    data: Omit<Goal, 'id' | 'userId' | 'isActive' | 'createdAt'>,
  ): Promise<Goal> {
    await this.goalRepository.deactivateAllForUser(userId);
    const goal = await this.goalRepository.save({
      ...data,
      userId,
      isActive: true,
    });

    const { data: exercises } = await this.exerciseRepository.findAll({
      page: 1,
      limit: 1000,
    });

    const userExercises = await this.userExerciseRepository.findByUser(userId);
    const ueMap = new Map(userExercises.map((ue) => [ue.exerciseId, ue]));

    const enriched: ExerciseWithPreference[] = exercises.map((e) => {
      const ue = ueMap.get(e.id);
      return {
        ...e,
        isFavorite: ue?.isFavorite ?? false,
        preferenceWeight: ue?.preferenceWeight ?? null,
      };
    });

    const profile = await this.profileRepository.findByUser(userId);
    const sessions = this.plannerService.generateSessions(
      goal,
      enriched,
      profile?.plannerConfig ?? undefined,
    );
    await this.sessionRepository.saveAll(sessions);

    return goal;
  }
}
