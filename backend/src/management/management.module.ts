import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ManagementController } from './management.controller.js';
import { ManagementService } from './management.service.js';

@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  controllers: [ManagementController],
  providers: [ManagementService],
})
export class ManagementModule {}
