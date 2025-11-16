// src/auth/auth.controller.ts
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Ip,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ----- keep your current logic exactly -----
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }
  // ------------------------------------------

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: any, @Ip() ip: string) {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip,
    });
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  // --- Google social login ---
  @Post('google')
  @HttpCode(200)
  async google(@Body() dto: GoogleLoginDto, @Req() req: any, @Ip() ip: string) {
    return this.authService.googleLogin(dto.idToken, {
      userAgent: req.headers['user-agent'],
      ip,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@GetUser() user: any) {
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard) // ensures only logged-in users can call logout
  @Post('logout')
  @HttpCode(200)
  async logout(
    @GetUser('id') userId: { sub: number },
    @Body() body: { refreshToken: string },
  ) {
    if (!body.refreshToken) {
      throw new BadRequestException('Refresh token required.');
    }
    return this.authService.logout(userId, body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'avatars');
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
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  async uploadAvatar(@GetUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relPath = `/uploads/avatars/${file.filename}`;
    const updated = await this.authService.updateAvatar(user.sub, relPath);
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('avatar')
  async deleteAvatar(@GetUser() user: any) {
    return this.authService.removeAvatar(user.sub);
  }

  // ===== Password reset =====
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // As requested: if email not found, return 404 with explicit message
    console.log("Email received for password reset:", dto.email);
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@GetUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
