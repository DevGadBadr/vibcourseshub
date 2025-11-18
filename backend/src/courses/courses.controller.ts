import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Post,
    Put,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
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

  // Upload a course brochure (PDF); returns a relative url under /uploads
  @UseGuards(JwtAuthGuard)
  @Post('brochure')
  @UseInterceptors(
    FileInterceptor('brochure', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'brochures');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.sub || 'u';
          const ext = extname(file.originalname || '').toLowerCase() || '.pdf';
          const name = `${userId}_${Date.now()}${ext}`;
          cb(null, name);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf'];
        if (!allowed.includes(file.mimetype)) return cb(new BadRequestException('Invalid file type'), false);
        cb(null, true);
      },
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    }),
  )
  async uploadBrochure(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relPath = `/uploads/brochures/${file.filename}`;
    return { url: relPath };
  }

  // Inline brochure streaming endpoint (forces inline render, not download)
  @Get(':slug/brochure/file')
  async brochureFile(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
    @Query('download') download?: string,
  ) {
    const detail: any = await this.courses.getBySlug(slug);
    const rel = detail?.brochureUrl as string | undefined;
    if (!rel) throw new NotFoundException('No brochure for this course');
    const filePath = join(process.cwd(), rel.startsWith('/') ? rel.slice(1) : rel);
    if (!existsSync(filePath)) throw new NotFoundException('Brochure file not found');
    const filename = decodeURIComponent(rel.split('/').pop() || 'brochure.pdf');
    const isDownload = download === '1' || download === 'true' || download === 'yes';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    });
    return new StreamableFile(createReadStream(filePath));
  }

  // HTML viewer with object tag and iframe fallback for better cross-platform support
  @Get(':slug/brochure/view')
  async brochureView(@Param('slug') slug: string, @Res() res: Response) {
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Course Brochure</title>
  <style>
    html,body{height:100%;margin:0;padding:0;overflow:hidden}
    #pdf-container,#pdf-fallback{width:100%;height:100%;border:none;display:block}
  </style>
</head>
<body>
  <object id="pdf-container" data="/courses/${slug}/brochure/file" type="application/pdf" width="100%" height="100%">
    <iframe id="pdf-fallback" src="/courses/${slug}/brochure/file" width="100%" height="100%"></iframe>
  </object>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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
