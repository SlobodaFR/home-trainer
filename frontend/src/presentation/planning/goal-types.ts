import type { GoalType } from '../../infrastructure/planning-client';

export const GOAL_TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'strength', label: 'Force' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general', label: 'Général' },
];

export const PLANNING_EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
];

export const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
