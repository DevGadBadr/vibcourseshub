import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { RequestVerificationDto } from './dto/request-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { EmailVerificationService } from './email.service.js';

@Controller('email-verification')
export class EmailVerificationController {
  constructor(private readonly emailService: EmailVerificationService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  async request(@Body() dto: RequestVerificationDto) {
    await this.emailService.requestVerification(dto.email);
    // Same response regardless of whether the email exists, to avoid user enumeration
    return {
      message: 'If that email exists, a verification link has been sent.',
    };
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async resend(@Body() dto: RequestVerificationDto) {
    await this.emailService.resend(dto.email);
    return {
      message: 'If that email exists, a new verification link has been sent.',
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyEmailDto) {
    const ok = await this.emailService.verify(dto.email, dto.token);
    if (!ok) throw new BadRequestException('Invalid or expired token');
    return { message: 'Email verified successfully.' };
  }

  // Optional: allow clicking a link directly
  @Get('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Query('email') email?: string,
    @Query('token') token?: string,
  ) {
    if (!email || !token) throw new BadRequestException('Missing parameters');
    const ok = await this.emailService.verify(email, token);
    return { success: ok };
  }
}
