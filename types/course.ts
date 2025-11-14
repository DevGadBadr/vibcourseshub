export type Course = {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  instructor: { id: number; name?: string | null; email?: string };
  averageRating?: number | null;
  ratingCount: number;
  thumbnailUrl?: string | null;
  isFeatured?: boolean;
};
