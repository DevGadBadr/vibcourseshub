import { Module } from '@nestjs/common';
import { EmailVerificationModule } from '../emailVerification/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule, EmailVerificationModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
