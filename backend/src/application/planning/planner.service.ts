import { Injectable } from '@nestjs/common';
import { ExerciseWithPreference } from '../../domain/exercise/exercise-with-preference';
import { Goal } from '../../domain/planning/goal';
import {
  NewSession,
  NewSessionExercise,
} from '../../domain/planning/session.repository';
import type { FitnessProfileConfig } from '../../domain/profile/user-fitness-profile';

@Injectable()
export class PlannerService {
  generateDates(
    activeFrom: string,
    horizonWeeks: number,
    availabilityDays: number[],
  ): string[] {
    const dates: string[] = [];
    const [year, month, day] = activeFrom.split('-').map(Number);
    const startMs = Date.UTC(year, month - 1, day);
    const totalDays = horizonWeeks * 7;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startMs + i * 86_400_000);
      if (availabilityDays.includes(d.getUTCDay())) {
        dates.push(d.toISOString().slice(0, 10));
      }
    }
    return dates;
  }

  buildSessionExercises(
    goal: Pick<Goal, 'sessionDurationMinutes' | 'availableEquipment'>,
    exercises: ExerciseWithPreference[],
    config?: FitnessProfileConfig,
  ): NewSessionExercise[] {
    let filtered = exercises.filter(
      (e) =>
        e.equipment.length === 0 ||
        e.equipment.some((eq) => goal.availableEquipment.includes(eq)),
    );

    if (filtered.length === 0 && goal.availableEquipment.length > 0) {
      filtered = exercises.filter((e) => e.equipment.length === 0);
    }

    const favorites = filtered.filter((e) => e.isFavorite);
    const nonFavorites = filtered.filter((e) => !e.isFavorite);

    const weighted = nonFavorites
      .filter((e) => e.preferenceWeight !== null)
      .sort((a, b) => (b.preferenceWeight ?? 0) - (a.preferenceWeight ?? 0));

    const unweighted = nonFavorites.filter((e) => e.preferenceWeight === null);
    for (let i = unweighted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unweighted[i], unweighted[j]] = [unweighted[j], unweighted[i]];
    }

    const sorted = [...favorites, ...weighted, ...unweighted];
    const budget = Math.max(1, Math.floor(goal.sessionDurationMinutes / 5));
    const selected = sorted.slice(0, budget);

    const sets = config?.maxSetsPerExercise ?? 3;
    const repsOrDuration = String(
      Math.round(10 * (config?.intensityMultiplier ?? 1)),
    );

    return selected.map((e, i) => ({
      exerciseId: e.id,
      exerciseName: e.name,
      order: i + 1,
      sets,
      repsOrDuration,
    }));
  }

  generateSessions(
    goal: Goal,
    exercises: ExerciseWithPreference[],
    config?: FitnessProfileConfig,
  ): NewSession[] {
    const dates = this.generateDates(
      goal.activeFrom,
      goal.horizonWeeks,
      goal.availabilityDays,
    );
    return dates.map((plannedDate) => ({
      userId: goal.userId,
      goalId: goal.id,
      plannedDate,
      exercises: this.buildSessionExercises(goal, exercises, config),
    }));
  }
}
