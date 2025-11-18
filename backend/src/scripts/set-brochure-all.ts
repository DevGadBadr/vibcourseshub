import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const url = '/uploads/brochures/VibSolution Training Brochure.pdf';
  const result = await prisma.course.updateMany({ data: { brochureUrl: url } });
  console.log(`Updated brochureUrl for ${result.count} courses to ${url}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
