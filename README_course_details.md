## Course Details Implementation

This file documents the newly added Course Details feature (Udemy-style) and how to extend it.

### Backend Changes

Prisma schema (`backend/prisma/schema.prisma`) additions:
- Extended `Course` model with fields: `shortDescription`, `fullDescription`, `previewVideoUrl`, `subtitleLanguages`, `labels`, `currency`, plus arrays for `learningOutcomes` and `curriculumSections` relations.
- Added models: `CourseLearningOutcome`, `CourseCurriculumSection`, `CourseLecture`.

Service changes (`backend/src/courses/courses.service.ts`):
- `getBySlug` now returns a normalized rich details payload including instructor info, labels, learning outcomes, curriculum sections/lectures, counts and pricing info.

### Frontend Changes

New types in `types/course.ts`:
- `CourseDetails`, `CourseInstructorInfo`, `CourseCurriculumSection`, `CourseLecture`.

API helper in `utils/api.ts`:
- `getCourseDetails(slug: string)` to fetch typed details.

New components under `components/course-details/`:
- `CoursePriceBlock` – formats and displays price/discount.
- `SectionHeader` – reusable section header.
- `WhatYouWillLearnList` – bullet list with check icons.
- `CurriculumAccordion` – collapsible curriculum sections with lectures.
- `InstructorCard` – instructor avatar/name/bio/stats + View Profile button (TODO navigation).
- `StickyBuyBar` – animated bottom bar showing condensed price + Buy button once scrolled.

New route screen:
- `app/(tabs)/courses/[slug]/index.tsx` implements the details UI: preview, title, badges, rating, instructors, pricing/actions, learning outcomes, curriculum, instructor card, sticky buy bar, skeleton loading, and simple fade-in animation.

### Pending TODOs / Future Work
- Replace placeholder star rendering inside details screen with shared star icon logic (export star renderer from `course-card` or create a dedicated utility).
- Implement preview video playback (currently button shows TODO alert).
- Add real instructor `shortBio` field to `User` or a dedicated instructor profile model.
- Populate `instructor.stats` with actual counts (aggregate queries) instead of `null`.
- Implement Buy/Add to Cart/Wishlist flows (currently alerts).
- Implement navigation to instructor profile (`router.push`).
- Add migrations for initial data seeding of learning outcomes and curriculum.
- Add validation / CRUD endpoints for learning outcomes and curriculum management (currently only read via `getBySlug`).

### Migration Instructions
1. Generate a new migration after schema changes:
```bash
cd backend
pnpm prisma migrate dev --name course_details
pnpm prisma generate
```
2. Ensure database has required new columns and tables.
3. (Optional) Seed curriculum & learning outcomes for existing courses via a script in `backend/src/scripts/` (not implemented yet).

### Data Shape Returned by `/courses/:slug`
```ts
type CourseDetails = {
  id: number;
  slug: string;
  title: string;
  shortDescription?: string | null;
  fullDescription?: string | null;
  thumbnailUrl?: string | null;
  previewVideoUrl?: string | null;
  labels?: string[];
  averageRating?: number | null;
  ratingsCount?: number; // ratingCount legacy mapped
  studentsCount?: number; // enrollments count
  lastUpdatedAt?: string;
  language?: string | null;
  subtitleLanguages?: string[];
  price?: number;
  discountPrice?: number | null;
  currency?: string; // default 'EGP'
  showPrice?: boolean;
  categories?: { id: number; name: string; slug: string }[];
  instructor?: {
    id: number;
    name?: string | null;
    avatarUrl?: string | null;
    shortBio?: string | null; // currently null
    stats?: { averageRating?: number | null; ratingsCount?: number; studentsCount?: number; coursesCount?: number } | null; // currently null
  } | null;
  whatYouWillLearn?: string[];
  curriculum?: Array<{ id: number; title: string; lectureCount: number; totalDurationSeconds: number; lectures: Array<{ id: number; title: string; durationSeconds?: number | null }> }>;
};
```

### Styling & Theming
All new UI components rely on `ThemedView`, `ThemedText`, and `useThemeColor` ensuring consistent theming with existing design system.

### Scroll & Sticky Bar Logic
- `StickyBuyBar` visibility toggles after user scrolls past the main price block (`priceBlockY`).
- Animated fade/slide uses React Native `Animated` value; on web it still appears fixed at bottom.

### Testing Tips
- Load an existing course slug via `/courses/:slug` route.
- Verify skeleton appears during fetch.
- Scroll past price block to ensure sticky bar animates in.
- Trigger TODO alerts (Buy/Add/Wishlist) for placeholders.

### Next Steps Proposal
Implement management endpoints & UI editors for curriculum and learning outcomes, add video preview player, hook into real purchase flow.
