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
  categories?: { id: number; name: string; slug: string }[];
  // Added for authenticated "mine" listing
  progressPct?: number | null;
  // Pricing
  price?: number;
  discountPrice?: number | null;
  showPrice?: boolean;
};
