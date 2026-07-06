export interface Goal {
  id: string;
  userId: string;
  type: 'strength' | 'mobility' | 'endurance' | 'general';
  targetDescription: string;
  horizonWeeks: number;
  availabilityDays: number[];
  sessionDurationMinutes: number;
  availableEquipment: string[];
  activeFrom: string;
  isActive: boolean;
  createdAt: Date;
}
