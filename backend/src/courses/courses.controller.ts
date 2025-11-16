import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GetUser } from '../common/decorators/get-user.decorator.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  async list(
    @Query('take') take = '20',
    @Query('cursor') cursor?: string,
    @Query('categoryIds') categoryIds?: string,
    @Query('instructorId') instructorId?: string,
  ) {
    const takeNum = Math.min(Math.max(parseInt(take, 10) || 20, 1), 50);
    const categories = (categoryIds || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n));
    const instrId = instructorId ? parseInt(instructorId, 10) : undefined;
    return this.courses.list({ take: takeNum, cursor: cursor ? Number(cursor) : undefined, categoryIds: categories.length ? categories : undefined, instructorId: Number.isInteger(instrId as any) ? (instrId as number) : undefined });
  }

  // Authenticated: list only courses the signed-in user is actively enrolled in.
  // MUST precede the param-based ':slug' route to avoid treating 'mine' as a slug.
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async mine(@GetUser() user: any) {
    return this.courses.listMine(user);
  }

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    return this.courses.getBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateCourseDto, @GetUser() user: any) {
    return this.courses.create(dto, user);
  }

  // Upload a course thumbnail; returns a relative url under /uploads
  @UseGuards(JwtAuthGuard)
  @Post('thumbnail')
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'course-thumbnails');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.sub || 'u';
          const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
          const name = `${userId}_${Date.now()}${ext}`;
          cb(null, name);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
        if (!allowed.includes(file.mimetype)) return cb(new BadRequestException('Invalid image type'), false);
        cb(null, true);
      },
      limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    }),
  )
  async uploadThumbnail(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relPath = `/uploads/course-thumbnails/${file.filename}`;
    return { url: relPath };
  }

  // Place the bulk reorder route BEFORE the param-based ':slug' route to avoid conflicts
  @UseGuards(JwtAuthGuard)
  @Put('reorder/bulk')
  async reorder(@Body() body: { items: { id: number; position: number }[] }, @GetUser() user: any) {
    return this.courses.reorder(body.items, user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':slug')
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateCourseDto,
    @GetUser() user: any,
  ) {
    return this.courses.update(slug, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':slug')
  async delete(@Param('slug') slug: string, @GetUser() user: any) {
    return this.courses.delete(slug, user);
  }
}
