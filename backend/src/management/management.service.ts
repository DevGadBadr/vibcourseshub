import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ManagementService {
  constructor(private prisma: PrismaService) {}

  private ensureManagerOrAdmin(role?: string) {
    if (role !== 'MANAGER' && role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient role');
    }
  }

  async listUsers(requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });
  }

  async getUserWithEnrollments(id: number, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        enrollments: {
          select: {
            courseId: true,
            course: { select: { id: true, title: true, thumbnailUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  // NOTE: listCourses is defined below with enroll counts; avoid duplicates here.

  async listCategories(requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    const items = await this.prisma.category.findMany({
      orderBy: [ { position: 'asc' }, { name: 'asc' } ],
      select: { id: true, name: true, slug: true, description: true, _count: { select: { courses: true } } },
    });
    return items.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, courseCount: (c as any)._count?.courses || 0 }));
  }

  async createCategory(body: { name: string; slug?: string; description?: string }, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    const slug = (body.slug || body.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return this.prisma.category.create({ data: { name: body.name.trim(), slug, description: body.description } });
  }

  async updateCategory(id: number, body: { name?: string; slug?: string; description?: string }, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.slug !== undefined) data.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (body.description !== undefined) data.description = body.description;
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: number, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    // Remove join rows first due to FK
    await this.prisma.courseCategory.deleteMany({ where: { categoryId: id } });
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  async reorderCategories(idsInOrder: number[], requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    // Assign incremental positions starting at 1
    await this.prisma.$transaction(
      idsInOrder.map((id, idx) => this.prisma.category.update({ where: { id }, data: { position: idx + 1 } }))
    );
    return { ok: true };
  }

  async listCourses(requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    return this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { position: 'asc' },
      select: { id: true, slug: true, title: true, thumbnailUrl: true, isPublished: true, instructor: { select: { id: true, name: true, email: true } }, _count: { select: { enrollments: true } } },
    }).then(arr => arr.map(c => ({ ...c, enrollCount: (c as any)._count?.enrollments || 0 })));
  }

  async setUserRole(userId: number, role: UserRole, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });
  }

  async deleteUser(userId: number, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    // Clean up enrollments and sessions to satisfy FKs
    await this.prisma.enrollment.deleteMany({ where: { userId } });
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }

  async addEnrollment(userId: number, courseId: number, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    try {
      await this.prisma.enrollment.create({ data: { userId, courseId } });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // already enrolled, treat as success
        return { ok: true };
      }
      throw e;
    }
    return { ok: true };
  }

  async removeEnrollment(userId: number, courseId: number, requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    await this.prisma.enrollment.delete({ where: { userId_courseId: { userId, courseId } } });
    return { ok: true };
  }
}
