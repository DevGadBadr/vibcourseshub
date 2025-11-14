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

  async listCourses(requestorRole?: string) {
    this.ensureManagerOrAdmin(requestorRole);
    return this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      select: { id: true, slug: true, title: true, thumbnailUrl: true, isPublished: true, instructor: { select: { id: true, name: true, email: true } } },
    });
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
