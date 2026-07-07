export interface FitnessProfileConfig {
  maxSetsPerExercise: number;
  intensityMultiplier: number;
}

export interface FitnessProfileDraft {
  level: 'beginner' | 'intermediate' | 'advanced';
  injuryNotes: string;
  equipmentComfortList: string[];
  specificGoal: string;
  summary: string;
  plannerConfig: FitnessProfileConfig;
}

export interface UserFitnessProfile extends FitnessProfileDraft {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
