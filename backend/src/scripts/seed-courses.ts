import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureInstructor(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: 'seeded',
      role: UserRole.INSTRUCTOR,
      isEmailVerified: true,
      name: 'Seed Instructor',
    },
  });
  return created.id;
}

async function main() {
  const instructorId = await ensureInstructor('instructor@example.com');

  const courses = [
    {
      slug: 'figma-ui-ux-design-essentials',
      title: 'Figma UI/UX Design Essentials',
      description:
        'Learn Figma fundamentals, components, and modern UI workflow.',
      instructorId,
      level: 'BEGINNER' as const,
      language: 'en',
      thumbnailUrl: 'https://picsum.photos/seed/figma/600/338',
      averageRating: 4.7 as any,
      ratingCount: 42917,
      isPublished: true,
      publishedAt: new Date(),
    },
    {
      slug: 'python-complete-bootcamp',
      title: 'Python Complete Bootcamp 2025',
      description: 'Zero to advanced Python with projects.',
      instructorId,
      level: 'BEGINNER' as const,
      language: 'en',
      thumbnailUrl: 'https://picsum.photos/seed/python/600/338',
      averageRating: 4.6 as any,
      ratingCount: 153752,
      isPublished: true,
      publishedAt: new Date(),
    },
  ];

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    await prisma.course.upsert({
      where: { slug: c.slug },
      create: { ...(c as any), position: i + 1 } as any,
      update: { ...(c as any), position: i + 1 } as any,
    });
  }

  console.log('Seeded example courses');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
