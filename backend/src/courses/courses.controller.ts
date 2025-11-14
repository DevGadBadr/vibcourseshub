import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GetUser } from '../common/decorators/get-user.decorator.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  async list(@Query('take') take = '20', @Query('cursor') cursor?: string) {
    const takeNum = Math.min(Math.max(parseInt(take, 10) || 20, 1), 50);
    return this.courses.list(takeNum, cursor ? Number(cursor) : undefined);
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
}
