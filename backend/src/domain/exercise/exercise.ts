export interface Exercise {
  id: string;
  wgerId: number | null;
  name: string;
  description: string;
  muscleGroups: string[];
  equipment: string[];
  youtubeUrl: string | null;
  everkineticSlug: string | null;
  createdAt: Date;
}
