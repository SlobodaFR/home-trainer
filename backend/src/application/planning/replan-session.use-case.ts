import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlannerService } from './planner.service';
import { ExerciseWithPreference } from '../../domain/exercise/exercise-with-preference';
import { ExerciseRepository } from '../../domain/exercise/exercise.repository';
import { UserExerciseRepository } from '../../domain/exercise/user-exercise.repository';
import { GoalRepository } from '../../domain/planning/goal.repository';
import { Session } from '../../domain/planning/session';
import { SessionRepository } from '../../domain/planning/session.repository';
import { ProfileRepository } from '../../domain/profile/profile.repository';

@Injectable()
export class ReplanSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly goalRepository: GoalRepository,
    private readonly exerciseRepository: ExerciseRepository,
    private readonly userExerciseRepository: UserExerciseRepository,
    private readonly plannerService: PlannerService,
    private readonly profileRepository: ProfileRepository,
  ) {}

  async execute(sessionId: string, userId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== 'planned') {
      throw new ConflictException(
        'Cannot replan a session that is not planned',
      );
    }

    const goal = await this.goalRepository.findActiveByUser(userId);
    if (!goal) throw new NotFoundException('No active goal found');

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
    const newExercises = this.plannerService.buildSessionExercises(
      goal,
      enriched,
      profile?.plannerConfig ?? undefined,
    );
    return this.sessionRepository.replaceExercises(sessionId, newExercises);
  }
}
