import { ExerciseOrmEntity } from './exercise.orm-entity';
import { GoalOrmEntity } from './goal.orm-entity';
import { RevokedSessionOrmEntity } from './revoked-session.orm-entity';
import { SessionOrmEntity } from './session.orm-entity';
import { SessionAnalysisOrmEntity } from './session-analysis.orm-entity';
import { SessionExerciseOrmEntity } from './session-exercise.orm-entity';
import { UserOrmEntity } from './user.orm-entity';
import { UserExerciseOrmEntity } from './user-exercise.orm-entity';
import { UserFitnessProfileOrmEntity } from './user-fitness-profile.orm-entity';
import { WorkoutLogOrmEntity } from './workout-log.orm-entity';

/** Single list of persisted entities: database module, seed, migrations and tests. */
export const ENTITIES = [
  UserOrmEntity,
  RevokedSessionOrmEntity,
  ExerciseOrmEntity,
  UserExerciseOrmEntity,
  GoalOrmEntity,
  SessionOrmEntity,
  SessionExerciseOrmEntity,
  WorkoutLogOrmEntity,
  SessionAnalysisOrmEntity,
  UserFitnessProfileOrmEntity,
];
