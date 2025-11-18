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
  async list(params: { take?: number; cursor?: number; categoryIds?: number[]; instructorId?: number } | number, cursor?: number) {
    // Backward compatibility: support legacy signature list(take, cursor)
    let take: number | undefined;
    let nextCursor: number | undefined = cursor;
    let categoryIds: number[] | undefined;
    let instructorId: number | undefined;
    if (typeof params === 'number') {
      take = params;
    } else {
      take = params.take;
      nextCursor = params.cursor;
      categoryIds = params.categoryIds;
      instructorId = params.instructorId;
    }
    const where: any = { isPublished: true };
    if (instructorId && Number.isInteger(instructorId)) {
      where.OR = [
        { instructorId },
        { instructors: { some: { userId: instructorId } } },
      ];
    }
    if (categoryIds && categoryIds.length > 0) {
      where.categories = { some: { categoryId: { in: categoryIds } } };
    }
    const courses = await this.prisma.course.findMany({
      where,
      // Cast to any to avoid transient Prisma type cache issues while ensuring DB orders by position first
  orderBy: [{ position: 'asc' }, { publishedAt: 'desc' }, { id: 'desc' }] as any,
      take: take ?? 20,
      ...(nextCursor ? { skip: 1, cursor: { id: nextCursor } } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        thumbnailUrl: true,
        averageRating: true,
        ratingCount: true,
        price: true,
        discountPrice: true,
        showPrice: true,
        instructor: { select: { id: true, name: true, email: true } },
        categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
      },
    });
    const data = courses.map((c) => ({
      ...c,
      categories: c.categories.map((cc) => cc.category),
    }));
    return { data, nextCursor: courses.at(-1)?.id ?? null };
  }

  // Return only published courses the user is actively enrolled in.
  // Security: user id taken solely from validated JWT payload (no client params).
  async listMine(userPayload: { sub: number }) {
    const userId = Number(userPayload?.sub);
    if (!userId || Number.isNaN(userId)) return { data: [] };
    // Fetch enrollments to include per-user progress (progressPct)
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE', course: { isPublished: true } },
      orderBy: [{ course: { position: 'asc' } }, { course: { publishedAt: 'desc' } }, { course: { id: 'desc' } }],
      select: {
        progressPct: true,
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            averageRating: true,
            ratingCount: true,
            price: true,
            discountPrice: true,
            showPrice: true,
            instructor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    const data = enrollments.map((e) => ({ ...e.course, progressPct: e.progressPct }));
    return { data, nextCursor: null };
  }

  async getBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        shortDescription: true,
        fullDescription: true,
        instructorId: true,
        instructor: { select: { id: true, name: true, title: true, email: true, avatarUrl: true } },
        thumbnailUrl: true,
        promoUrl: true,
        previewVideoUrl: true,
        brochureUrl: true,
        level: true,
        language: true,
        // subtitleLanguages: true, // hidden for now
        durationSeconds: true,
        isPublished: true,
        isFeatured: true,
        price: true,
        discountPrice: true,
        showPrice: true,
        currency: true,
        // Multi enrollment pricing
        priceRecordedEgp: true,
        priceRecordedUsd: true,
        priceOnlineEgp: true,
        priceOnlineUsd: true,
        averageRating: true,
        ratingCount: true,
        // labels: true,
        updatedAt: true,
        categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { enrollments: true } },
        curriculumSections: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            totalDurationSeconds: true,
            lectures: {
              orderBy: { position: 'asc' },
              select: { id: true, title: true, position: true, durationSeconds: true }
            },
          },
        },
        learningOutcomes: {
          orderBy: { position: 'asc' },
          select: { id: true, text: true, position: true },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    // Normalize + enrich for details view while keeping backward compatibility for callers
    const categories = (course as any).categories ? (course as any).categories.map((cc: any) => cc.category) : undefined;
    const studentsCount = (course as any)._count?.enrollments ?? 0;
    const instructor = (course as any).instructor ?? { id: course.instructorId };
    const badges = Array.isArray((course as any).labels) ? (course as any).labels : [];
    const sections = (course as any).curriculumSections?.map((s: any) => {
      const total = typeof s.totalDurationSeconds === 'number' && s.totalDurationSeconds >= 0
        ? s.totalDurationSeconds
        : (s.lectures || []).reduce((acc: number, l: any) => acc + (Number(l?.durationSeconds || 0) || 0), 0);
      return {
        id: s.id,
        title: s.title,
        position: s.position,
        lectureCount: (s.lectures || []).length,
        totalDurationSeconds: total,
        lectures: (s.lectures || []).map((l: any) => ({ id: l.id, title: l.title, durationSeconds: l.durationSeconds ?? null })),
      };
    }) ?? [];
    const details = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      // Prefer shortDescription; fallback to legacy description
      shortDescription: (course as any).shortDescription ?? course.description ?? null,
      fullDescription: (course as any).fullDescription ?? course.description ?? null,
      thumbnailUrl: course.thumbnailUrl,
      previewVideoUrl: (course as any).previewVideoUrl ?? course.promoUrl ?? null,
      brochureUrl: (course as any).brochureUrl ?? null,
      language: course.language,
      // subtitleLanguages: (course as any).subtitleLanguages ?? [],
      averageRating: course.averageRating ?? null,
      ratingsCount: course.ratingCount ?? 0,
      studentsCount,
      lastUpdatedAt: (course as any).updatedAt,
      price: course.price,
      discountPrice: course.discountPrice ?? null,
      currency: (course as any).currency ?? 'EGP',
      priceRecordedEgp: (course as any).priceRecordedEgp ?? null,
      priceRecordedUsd: (course as any).priceRecordedUsd ?? null,
      priceOnlineEgp: (course as any).priceOnlineEgp ?? null,
      priceOnlineUsd: (course as any).priceOnlineUsd ?? null,
      // labels: badges,
      categories,
      instructor: instructor ? {
        id: instructor.id,
        name: instructor.name ?? null,
        title: instructor.title ?? null,
        avatarUrl: instructor.avatarUrl ?? null,
        shortBio: null, // TODO: add instructor short bio to User or separate profile
        stats: null,    // TODO: compute rating, students, courses counts if needed
      } : null,
      // Replaced by brochure viewer
      whatYouWillLearn: undefined,
      curriculum: undefined,
      isPublished: course.isPublished,
      isFeatured: course.isFeatured,
      showPrice: course.showPrice,
    } as any;
    return details;
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
    // Generate slug if not provided, ensure uniqueness
    let slug = (dto.slug || dto.title || '').toString();
    slug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) slug = `course-${Date.now()}`;
    // ensure uniqueness by appending count if needed
    let finalSlug = slug;
    let suffix = 1;
    while (await this.prisma.course.findUnique({ where: { slug: finalSlug } })) {
      suffix += 1;
      finalSlug = `${slug}-${suffix}`;
    }

    const data: any = {
      slug: finalSlug,
      title: dto.title,
      description: dto.description,
      shortDescription: dto.shortDescription ?? null,
      fullDescription: dto.fullDescription ?? null,
      instructorId,
      durationSeconds: dto.durationSeconds,
      level: dto.level,
      language: dto.language,
      subtitleLanguages: Array.isArray(dto.subtitleLanguages) ? dto.subtitleLanguages : [],
      thumbnailUrl: dto.thumbnailUrl,
      promoUrl: dto.promoUrl ?? null,
      previewVideoUrl: dto.previewVideoUrl ?? null,
      brochureUrl: dto.brochureUrl ?? null,
      labels: Array.isArray(dto.labels) ? dto.labels : [],
      currency: dto.currency || 'EGP',
      isPublished,
      averageRating: 5,
      ratingCount: 0,
      publishedAt: isPublished ? new Date() : null,
      position: nextPosition,
      price: dto.price ?? 0,
      discountPrice: dto.discountPrice ?? null,
      showPrice: dto.showPrice ?? true,
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

    // Persist categories if provided
    if (Array.isArray(dto.categoriesIds) && dto.categoriesIds.length > 0) {
      const uniqueCatIds = Array.from(new Set(dto.categoriesIds.filter((n) => Number.isInteger(n))));
      if (uniqueCatIds.length > 0) {
        const validCats = await this.prisma.category.findMany({ where: { id: { in: uniqueCatIds } }, select: { id: true } });
        const validCatIds = validCats.map((c) => c.id);
        if (validCatIds.length > 0) {
          await this.prisma.courseCategory.createMany({
            data: validCatIds.map((id) => ({ courseId: created.id, categoryId: id })),
            skipDuplicates: true,
          });
        }
      }
    }

    // Persist learning outcomes (whatYou'llLearn) if provided
    if (Array.isArray(dto.whatYouWillLearn) && dto.whatYouWillLearn.length > 0) {
      const clean = dto.whatYouWillLearn.map((t) => (typeof t === 'string' ? t.trim() : '')).filter((t) => t.length > 0);
      if (clean.length > 0) {
        await this.prisma.courseLearningOutcome.createMany({
          data: clean.map((text, idx) => ({ courseId: created.id, text, position: idx + 1 })),
          skipDuplicates: true,
        });
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
    // Never pass relation helper arrays to Prisma update.data
    const { categoriesIds, ...rest } = dto as any;
    if (isAdmin) {
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== undefined) (data as any)[k] = v;
      });
      // Maintain publishedAt when toggling isPublished
      if (rest.isPublished !== undefined) {
        data.publishedAt = rest.isPublished ? (course.isPublished ? course.isPublished && undefined : new Date()) : null;
      }
    } else {
      allowedForInstructor.forEach((k) => {
        if ((rest as any)[k] !== undefined) (data as any)[k] = (rest as any)[k];
      });
    }

    const updated = await this.prisma.course.update({ where: { slug }, data });

    // Optionally replace categories if provided
    if (Array.isArray(categoriesIds)) {
      const ids = Array.from(new Set(categoriesIds.filter((n: any) => Number.isInteger(n))));
      await this.prisma.$transaction([
        this.prisma.courseCategory.deleteMany({ where: { courseId: updated.id } }),
        ...(ids.length
          ? [
              this.prisma.courseCategory.createMany({
                data: ids.map((id) => ({ courseId: updated.id, categoryId: id })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);
    }
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
