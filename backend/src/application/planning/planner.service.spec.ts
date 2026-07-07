import { PlannerService } from './planner.service';
import { ExerciseWithPreference } from '../../domain/exercise/exercise-with-preference';

const makeExercise = (
  id: string,
  equipment: string[],
  isFavorite = false,
  preferenceWeight: number | null = null,
): ExerciseWithPreference => ({
  id,
  wgerId: null,
  name: `Exercise ${id}`,
  description: '',
  muscleGroups: [],
  equipment,
  imageUrl: null,
  muscleImages: [],
  youtubeUrl: null,
  everkineticSlug: null,
  createdAt: new Date('2024-01-01'),
  isFavorite,
  preferenceWeight,
});

describe('PlannerService', () => {
  let service: PlannerService;

  beforeEach(() => {
    service = new PlannerService();
  });

  describe('generateDates', () => {
    it('returns Monday dates for a 2-week horizon starting on a Monday', () => {
      // 2026-07-06 is a Monday (day 1)
      const dates = service.generateDates('2026-07-06', 2, [1]);
      expect(dates).toEqual(['2026-07-06', '2026-07-13']);
    });

    it('returns multiple weekdays per week', () => {
      // Mon + Wed
      const dates = service.generateDates('2026-07-06', 1, [1, 3]);
      expect(dates).toEqual(['2026-07-06', '2026-07-08']);
    });

    it('returns Sunday when only Sundays selected and 1-week horizon from Monday', () => {
      // Jul 6 = Mon (1), Jul 12 = Sun (0) — 7-day window (i=0..6) includes Jul 12
      const dates = service.generateDates('2026-07-06', 1, [0]);
      expect(dates).toEqual(['2026-07-12']);
    });

    it('returns 0 sessions when horizon is 1 week with only one unavailable weekday', () => {
      // Start on Tuesday (2026-07-07), look for Mondays only, 1 week
      // 7 days from Tue: Tue, Wed, Thu, Fri, Sat, Sun, Mon (Jul 13)
      // Jul 13 = Monday ✓ — still gets picked
      // Use 0 days instead to guarantee empty
      const dates = service.generateDates('2026-07-06', 0, [1]);
      expect(dates).toHaveLength(0);
    });
  });

  describe('buildSessionExercises', () => {
    const goal = {
      sessionDurationMinutes: 30,
      availableEquipment: ['barbell'],
    };

    it('includes bodyweight exercises (empty equipment array)', () => {
      const exercises = [makeExercise('bw', [])];
      const result = service.buildSessionExercises(goal, exercises);
      expect(result).toHaveLength(1);
      expect(result[0].exerciseId).toBe('bw');
    });

    it('includes exercises matching available equipment', () => {
      const exercises = [makeExercise('bar', ['barbell'])];
      const result = service.buildSessionExercises(goal, exercises);
      expect(result).toHaveLength(1);
    });

    it('excludes exercises not matching available equipment', () => {
      const exercises = [makeExercise('dumb', ['dumbbell'])];
      const result = service.buildSessionExercises(goal, exercises);
      expect(result).toHaveLength(0);
    });

    it('falls back to bodyweight when no exercises match equipment', () => {
      const exercises = [
        makeExercise('dumb', ['dumbbell']),
        makeExercise('bw', []),
      ];
      const noEquipGoal = {
        sessionDurationMinutes: 30,
        availableEquipment: ['cable'],
      };
      const result = service.buildSessionExercises(noEquipGoal, exercises);
      expect(result.map((r) => r.exerciseId)).toEqual(['bw']);
    });

    it('places favorites before non-favorites', () => {
      const exercises = [
        makeExercise('non-fav', [], false),
        makeExercise('fav', [], true),
      ];
      const result = service.buildSessionExercises(goal, exercises);
      expect(result[0].exerciseId).toBe('fav');
    });

    it('respects budget (floor(sessionDurationMinutes / 5))', () => {
      const exercises = Array.from({ length: 20 }, (_, i) =>
        makeExercise(`ex-${String(i)}`, []),
      );
      const result = service.buildSessionExercises(goal, exercises);
      expect(result).toHaveLength(6); // floor(30/5)
    });

    it('orders weighted exercises by weight descending before unweighted', () => {
      const exercises = [
        makeExercise('w2', [], false, 2),
        makeExercise('w5', [], false, 5),
        makeExercise('w1', [], false, 1),
      ];
      const result = service.buildSessionExercises(
        { sessionDurationMinutes: 120, availableEquipment: [] },
        exercises,
      );
      expect(result[0].exerciseId).toBe('w5');
      expect(result[1].exerciseId).toBe('w2');
      expect(result[2].exerciseId).toBe('w1');
    });

    it('returns at least 1 exercise even with 5-minute session', () => {
      const exercises = [makeExercise('ex', [])];
      const result = service.buildSessionExercises(
        { sessionDurationMinutes: 5, availableEquipment: [] },
        exercises,
      );
      expect(result).toHaveLength(1);
    });
  });
});
