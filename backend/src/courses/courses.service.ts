import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}
  async list(take = 20, cursor?: number) {
    const where = { isPublished: true } as const;
    const courses = await this.prisma.course.findMany({
      where,
      // Cast to any to avoid transient Prisma type cache issues while ensuring DB orders by position first
  orderBy: [{ position: 'asc' }, { publishedAt: 'desc' }, { id: 'desc' }] as any,
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        averageRating: true,
        ratingCount: true,
        instructor: { select: { id: true, name: true, email: true } },
      },
    });
    return { data: courses, nextCursor: courses.at(-1)?.id ?? null };
  }

  // Return only published courses the user is actively enrolled in.
  // Security: user id taken solely from validated JWT payload (no client params).
  async listMine(userPayload: { sub: number }) {
    const userId = Number(userPayload?.sub);
    if (!userId || Number.isNaN(userId)) return { data: [] };
    const courses = await this.prisma.course.findMany({
      where: {
        isPublished: true,
        enrollments: { some: { userId, status: 'ACTIVE' } },
      },
      orderBy: [{ position: 'asc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        averageRating: true,
        ratingCount: true,
        instructor: { select: { id: true, name: true, email: true } },
      },
    });
    return { data: courses, nextCursor: null };
  }

  async getBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        instructorId: true,
        thumbnailUrl: true,
        promoUrl: true,
        level: true,
        language: true,
        durationSeconds: true,
        isPublished: true,
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(dto: CreateCourseDto, user: { id: number; role: string }) {
    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') throw new ForbiddenException();
    let instructorId = dto.instructorId;
    if (!instructorId && dto.instructorEmail) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.instructorEmail },
      });
      if (existing) instructorId = existing.id;
      else {
        const created = await this.prisma.user.create({
          data: {
            email: dto.instructorEmail,
            passwordHash: 'seeded',
            role: 'INSTRUCTOR',
            isEmailVerified: true,
            name: dto.instructorEmail.split('@')[0],
          },
        });
        instructorId = created.id;
      }
    }
    if (!instructorId)
      throw new ForbiddenException(
        'instructorId or instructorEmail is required',
      );

  // Determine next position (append to end) — use count for simplicity
  const total = await this.prisma.course.count();
  const nextPosition = total + 1;

    const isPublished = dto.isPublished ?? true;
    const data = {
      slug: dto.slug,
      title: dto.title,
      description: dto.description,
      instructorId,
      durationSeconds: dto.durationSeconds,
      level: dto.level,
      language: dto.language,
      thumbnailUrl: dto.thumbnailUrl,
      promoUrl: dto.promoUrl ?? null,
      isPublished,
      averageRating: 5,
      ratingCount: 0,
      publishedAt: isPublished ? new Date() : null,
      position: nextPosition,
    };
    const created = await this.prisma.course.create({ data });

    // Persist additional co-instructors if provided
    if (Array.isArray(dto.instructorsIds) && dto.instructorsIds.length > 0) {
      const uniqueIds = Array.from(new Set(dto.instructorsIds.filter((n) => Number.isInteger(n) && n !== created.instructorId)));
      if (uniqueIds.length > 0) {
        // Optional: filter to only users with INSTRUCTOR role
        const valid = await this.prisma.user.findMany({ where: { id: { in: uniqueIds }, role: 'INSTRUCTOR' }, select: { id: true } });
        const validIds = valid.map((u) => u.id);
        if (validIds.length > 0) {
          await this.prisma.courseInstructor.createMany({
            data: validIds.map((id) => ({ courseId: created.id, userId: id })),
            skipDuplicates: true,
          });
        }
      }
    }

    return created;
  }

  async update(
    slug: string,
    dto: UpdateCourseDto,
    user: { id: number; role: string },
  ) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      select: { id: true, instructorId: true, isPublished: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const isInstructorOwner = user?.role === 'INSTRUCTOR' && course.instructorId === user.id;
    if (!isAdmin && !isInstructorOwner) throw new ForbiddenException();

    // Instructors can only edit limited fields; admins/managers can edit all.
    const allowedForInstructor: (keyof UpdateCourseDto)[] = [
      'title',
      'description',
      'thumbnailUrl',
      'promoUrl',
      'language',
      'level',
      'durationSeconds',
    ];
    const data: Partial<UpdateCourseDto & { publishedAt?: Date | null }> = {};
    if (isAdmin) {
      Object.entries(dto).forEach(([k, v]) => {
        if (v !== undefined) (data as any)[k] = v;
      });
      // Maintain publishedAt when toggling isPublished
      if (dto.isPublished !== undefined) {
        data.publishedAt = dto.isPublished ? (course.isPublished ? course.isPublished && undefined : new Date()) : null;
      }
    } else {
      allowedForInstructor.forEach((k) => {
        if (dto[k] !== undefined) (data as any)[k] = dto[k];
      });
    }

    const updated = await this.prisma.course.update({ where: { slug }, data });
    return updated;
  }

  async reorder(
    items: { id: number; position: number }[],
    user: { id: number; role: string },
  ) {
    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') throw new ForbiddenException();
    if (!Array.isArray(items) || items.length === 0) return { ok: true };
    const normalized = items
      .filter(
        (i) => Number.isInteger(i.id) && Number.isInteger(i.position) && i.position >= 1,
      )
      .sort((a, b) => a.position - b.position)
      .map((it, idx) => ({ id: it.id, position: idx + 1 }));
    await this.prisma.$transaction(
      normalized.map((it) =>
        this.prisma.course.update({ where: { id: it.id }, data: { position: it.position } as any }),
      ),
    );
    return { ok: true };
  }

  async delete(slug: string, user: { id: number; role: string }) {
    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') throw new ForbiddenException();
    const course = await this.prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!course) throw new NotFoundException('Course not found');
    // Remove enrollments then course to avoid FK restriction
    await this.prisma.$transaction([
      this.prisma.enrollment.deleteMany({ where: { courseId: course.id } }),
      this.prisma.course.delete({ where: { id: course.id } }),
    ]);
    return { ok: true };
  }
}
