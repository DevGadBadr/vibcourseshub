import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  // Public: list all categories with counts
  @Get()
  async list() {
    const items = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: { select: { courses: true } },
      },
    });
    return items.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, courseCount: c._count.courses }));
  }
}
