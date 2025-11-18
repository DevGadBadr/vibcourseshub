export type Course = {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  shortDescription?: string | null;
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

export type CourseInstructorInfo = {
  id: number;
  name?: string | null;
  title?: string | null;
  avatarUrl?: string | null;
  shortBio?: string | null;
  stats?: { averageRating?: number | null; ratingsCount?: number; studentsCount?: number; coursesCount?: number } | null;
};

export type CourseLecture = { id: number; title: string; durationSeconds?: number | null };
export type CourseCurriculumSection = { id: number; title: string; lectureCount: number; totalDurationSeconds: number; lectures: CourseLecture[] };

export type CourseDetails = {
  id: number;
  slug: string;
  title: string;
  shortDescription?: string | null;
  fullDescription?: string | null;
  thumbnailUrl?: string | null;
  previewVideoUrl?: string | null;
  brochureUrl?: string | null;
  averageRating?: number | null;
  ratingsCount?: number;
  studentsCount?: number;
  lastUpdatedAt?: string;
  language?: string | null;
  price?: number;
  discountPrice?: number | null;
  currency?: string;
  showPrice?: boolean;
  // Multi enrollment pricing
  priceRecordedEgp?: number | null;
  priceRecordedUsd?: number | null;
  priceOnlineEgp?: number | null;
  priceOnlineUsd?: number | null;
  categories?: { id: number; name: string; slug: string }[];
  instructor?: CourseInstructorInfo | null;
  // whatYouWillLearn?: string[];
  // curriculum?: CourseCurriculumSection[];
};
