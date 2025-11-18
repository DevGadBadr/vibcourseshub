import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateShort(title: string, existing?: string | null) {
  if (existing && existing.trim().length >= 24) return existing.trim();
  const base = title.replace(/course/i, '').trim();
  return `Master ${base} from scratch with hands-on projects.`.replace(/\s+/g, ' ').trim();
}

function generateFull(title: string, existingShort?: string | null, existingFull?: string | null) {
  if (existingFull && existingFull.trim().length > 80) return existingFull.trim();
  const short = existingShort || generateShort(title);
  return [
    short,
    '',
    `In this comprehensive course we dive deep into ${title}. You will build practical features, understand core concepts, and apply best practices.`,
    '',
    'By the end you will be confident applying these skills in real-world scenarios.'
  ].join('\n');
}

function deriveLabels(c: any): string[] {
  const labels: string[] = [];
  if ((c.ratingCount ?? 0) > 50) labels.push('Popular');
  if ((c.averageRating ?? 0) >= 4.7) labels.push('Highly rated');
  const createdAt = c.createdAt ? new Date(c.createdAt) : null;
  if (createdAt && Date.now() - createdAt.getTime() < 1000 * 60 * 60 * 24 * 30) labels.push('New');
  return Array.from(new Set(labels));
}

function buildOutcomes(title: string): string[] {
  return [
    `Understand fundamental concepts of ${title}`,
    `Build a complete real-world project with ${title}`,
    `Optimize performance and follow best practices in ${title}`,
    `Gain confidence to apply ${title} professionally`
  ];
}

async function seed() {
  const courses = await prisma.course.findMany({});
  console.log(`Found ${courses.length} courses.`);
  for (const c of courses) {
    const updates: any = {};
    if (!c.shortDescription) updates.shortDescription = generateShort(c.title, c.description);
    if (!c.fullDescription) updates.fullDescription = generateFull(c.title, updates.shortDescription || c.shortDescription, c.fullDescription);
    if (!c.previewVideoUrl && c.promoUrl) updates.previewVideoUrl = c.promoUrl; // reuse promo if available
    if (!c.currency) updates.currency = 'EGP';
    if (!c.labels || c.labels.length === 0) updates.labels = deriveLabels(c);
    // Ensure subtitleLanguages array exists even if empty
    if (!c.subtitleLanguages) updates.subtitleLanguages = [];
    const needUpdate = Object.keys(updates).length > 0;
    if (needUpdate) {
      await prisma.course.update({ where: { id: c.id }, data: updates });
      console.log(`Updated course ${c.slug} with: ${Object.keys(updates).join(', ')}`);
    }
    // Learning outcomes
    const existingOutcomes = await prisma.courseLearningOutcome.count({ where: { courseId: c.id } });
    if (existingOutcomes === 0) {
      const outcomes = buildOutcomes(c.title);
      await prisma.courseLearningOutcome.createMany({ data: outcomes.map((text, idx) => ({ courseId: c.id, text, position: idx + 1 })) });
      console.log(`Added ${outcomes.length} learning outcomes to ${c.slug}`);
    }
    // Curriculum sections
    const existingSections = await prisma.courseCurriculumSection.count({ where: { courseId: c.id } });
    if (existingSections === 0) {
      const sectionsData = [
        { title: 'Introduction', lectures: ['Welcome', 'Overview & Setup'] },
        { title: 'Core Concepts', lectures: ['Fundamentals Deep Dive', 'Hands-on Workshop'] }
      ];
      for (let sIdx = 0; sIdx < sectionsData.length; sIdx++) {
        const s = sectionsData[sIdx];
        const section = await prisma.courseCurriculumSection.create({ data: { courseId: c.id, title: s.title, position: sIdx + 1 } });
        for (let lIdx = 0; lIdx < s.lectures.length; lIdx++) {
          const title = s.lectures[lIdx];
          await prisma.courseLecture.create({ data: { sectionId: section.id, title, position: lIdx + 1, durationSeconds: 120 + (lIdx * 90) } });
        }
        // Update cached duration
        const lectures = await prisma.courseLecture.findMany({ where: { sectionId: section.id } });
        const total = lectures.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
        await prisma.courseCurriculumSection.update({ where: { id: section.id }, data: { totalDurationSeconds: total } });
      }
      console.log(`Added curriculum sections to ${c.slug}`);
    }
  }
  console.log('Seeding complete.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
