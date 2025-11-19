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
import { promises as fs } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GetUser } from '../common/decorators/get-user.decorator.js';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_PDF_TYPES,
  DEFAULT_PAGINATION_TAKE,
  FILE_UPLOAD_LIMITS,
  MAX_PAGINATION_TAKE,
} from '../common/constants.js';
import { generateBrochureViewerHtml } from '../common/templates/brochure-viewer.template.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  async list(
    @Query('take') take = String(DEFAULT_PAGINATION_TAKE),
    @Query('cursor') cursor?: string,
    @Query('categoryIds') categoryIds?: string,
    @Query('instructorId') instructorId?: string,
  ) {
    const takeNum = Math.min(
      Math.max(parseInt(take, 10) || DEFAULT_PAGINATION_TAKE, 1),
      MAX_PAGINATION_TAKE,
    );
    const categories = (categoryIds || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n));
    const instrId = instructorId ? parseInt(instructorId, 10) : undefined;

    return this.courses.list({
      take: takeNum,
      cursor: cursor ? Number(cursor) : undefined,
      categoryIds: categories.length > 0 ? categories : undefined,
      instructorId:
        instrId !== undefined && Number.isInteger(instrId)
          ? instrId
          : undefined,
    });
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
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as any)) {
          return cb(new BadRequestException('Invalid image type'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: FILE_UPLOAD_LIMITS.THUMBNAIL_MAX_SIZE },
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
        if (!ALLOWED_PDF_TYPES.includes(file.mimetype as any)) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: FILE_UPLOAD_LIMITS.BROCHURE_MAX_SIZE },
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

  // JSON/base64 brochure data endpoint (for inline web viewers without triggering download managers)
  @Get(':slug/brochure/data')
  async brochureData(@Param('slug') slug: string) {
    const detail: any = await this.courses.getBySlug(slug);
    const rel = detail?.brochureUrl as string | undefined;
    if (!rel) throw new NotFoundException('No brochure for this course');
    const filePath = join(process.cwd(), rel.startsWith('/') ? rel.slice(1) : rel);
    if (!existsSync(filePath)) throw new NotFoundException('Brochure file not found');
    const { readFile } = await import('fs/promises');
    const buf = await readFile(filePath);
    // Return base64 so the client can reconstruct a Blob without the response
    // being treated as a direct PDF download by browser helpers.
    return {
      data: buf.toString('base64'),
    };
  }

  // HTML viewer with object tag and iframe fallback for better cross-platform support
  @Get(':slug/brochure/view')
  async brochureView(@Param('slug') slug: string, @Res() res: Response) {
    const html = generateBrochureViewerHtml(slug);
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
