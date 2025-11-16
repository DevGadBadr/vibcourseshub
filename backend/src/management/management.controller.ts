import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GetUser } from '../common/decorators/get-user.decorator.js';
import { ManagementService } from './management.service.js';

@UseGuards(JwtAuthGuard)
@Controller('management')
export class ManagementController {
  constructor(private readonly svc: ManagementService) {}

  @Get('users')
  listUsers(@GetUser() user: any) {
    return this.svc.listUsers(user?.role);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseIntPipe) id: number, @GetUser() user: any) {
    return this.svc.getUserWithEnrollments(id, user?.role);
  }

  @Patch('users/:id/role')
  setRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { role: 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN' | 'MANAGER' },
    @GetUser() user: any,
  ) {
    return this.svc.setUserRole(id, body.role as any, user?.role);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number, @GetUser() user: any) {
    return this.svc.deleteUser(id, user?.role);
  }

  @Get('courses')
  listCourses(@GetUser() user: any) {
    return this.svc.listCourses(user?.role);
  }

  // Categories management
  @Get('categories')
  listCategories(@GetUser() user: any) {
    return this.svc.listCategories(user?.role);
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; slug?: string; description?: string }, @GetUser() user: any) {
    return this.svc.createCategory(body, user?.role);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; slug?: string; description?: string },
    @GetUser() user: any,
  ) {
    return this.svc.updateCategory(id, body, user?.role);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number, @GetUser() user: any) {
    return this.svc.deleteCategory(id, user?.role);
  }

  @Patch('categories/reorder')
  reorderCategories(@Body() body: { ids: number[] }, @GetUser() user: any) {
    return this.svc.reorderCategories(body.ids, user?.role);
  }

  @Post('users/:id/enrollments')
  addEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { courseId: number },
    @GetUser() user: any,
  ) {
    return this.svc.addEnrollment(id, Number(body.courseId), user?.role);
  }

  @Delete('users/:id/enrollments/:courseId')
  removeEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @GetUser() user: any,
  ) {
    return this.svc.removeEnrollment(id, courseId, user?.role);
  }
}
