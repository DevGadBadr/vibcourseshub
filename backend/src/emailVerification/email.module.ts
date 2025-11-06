import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailVerificationController } from './email.controller.js';
import { EmailVerificationService } from './email.service.js';

@Module({
  imports: [PrismaModule, CacheModule.register()],
  controllers: [EmailVerificationController],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}
