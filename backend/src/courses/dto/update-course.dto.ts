// Simple manual partial type to avoid extra dependency

export class UpdateCourseDto {
  title?: string;
  slug?: string;
  description?: string;
  instructorId?: number;
  durationSeconds?: number;
  level?: any;
  language?: string;
  thumbnailUrl?: string;
  promoUrl?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
}
