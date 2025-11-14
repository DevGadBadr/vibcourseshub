import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport/dist/index.js';
import { EmailVerificationModule } from '../emailVerification/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokensService } from './tokens.service.js';

@Module({
  imports: [
    PrismaModule,
    EmailVerificationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensService, JwtService, JwtStrategy],
})
export class AuthModule {}
