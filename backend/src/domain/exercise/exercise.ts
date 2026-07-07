export interface MuscleImage {
  url: string;
  isFront: boolean;
  isSecondary: boolean;
}

export interface Exercise {
  id: string;
  wgerId: number | null;
  name: string;
  description: string;
  muscleGroups: string[];
  equipment: string[];
  imageUrl: string | null;
  muscleImages: MuscleImage[];
  youtubeUrl: string | null;
  everkineticSlug: string | null;
  createdAt: Date;
}
