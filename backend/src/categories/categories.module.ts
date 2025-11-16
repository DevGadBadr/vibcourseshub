import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CategoriesController } from './categories.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
