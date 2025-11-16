import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const courses = await prisma.course.findMany({ select: { id: true, title: true } });
  const updates = [] as any[];
  for (const c of courses) {
    // Random base price in EGP (e.g., 199 to 1999)
    const base = randInt(199, 1999);
    const hasDiscount = Math.random() < 0.7; // 70% discounted
    const discount = hasDiscount ? Math.max(49, Math.round(base * (0.4 + Math.random() * 0.4))) : null; // 40%-80% of base
    const price = Math.max(base, discount ?? 0);
    const discountPrice = hasDiscount ? Math.min(discount!, price - 10) : null;
    updates.push(
      prisma.course.update({
        where: { id: c.id },
        data: {
          showPrice: true,
          price: price,
          discountPrice: discountPrice,
        },
      })
    );
  }
  if (updates.length) await prisma.$transaction(updates);
  console.log(`Updated pricing for ${updates.length} course(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
