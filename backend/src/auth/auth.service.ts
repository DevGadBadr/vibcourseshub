import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt/dist/index.js';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import 'dotenv/config';
import nodemailer, { Transporter } from 'nodemailer';
import { buildPasswordResetEmail } from '../emailVerification/email.templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { SignupDto } from './dto/signup.dto';
import { TokensService } from './tokens.service';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokens: TokensService,
    private jwt: JwtService,
  ) {}

  // --- email sending (reuse SMTP config) ---
  private mailer: Transporter | null = null;
  private ensureMailer(): Transporter {
    if (this.mailer) return this.mailer;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('SMTP configuration missing for password reset emails');
    }
    this.mailer = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return this.mailer;
  }

  private buildResetLink(email: string, token: string) {
    const rawBase =
      process.env.RESET_PASSWORD_URL ||
      process.env.FRONTEND_URL ||
      'http://devgadbadr.com:3010/reset-password';
    const url = new URL(rawBase);
    // Ensure path ends with /reset-password if not explicit
    const normalized = url.pathname?.trim() || '/';
    const hasReset = /\/reset-password\/?$/i.test(normalized);
    if (!hasReset) {
      const basePath = normalized === '/' ? '' : normalized.replace(/\/$/, '');
      url.pathname = `${basePath}/reset-password`;
    }
    url.searchParams.set('email', email);
    url.searchParams.set('token', token);
    return url.toString();
  }

  // 🔐 Proper bcrypt validation
  private async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    if (!user.isActive) return null;

    // ✅ Compare plain password with the stored bcrypt hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;

    return user;
  }

  async login(dto: LoginDto, meta?: { userAgent?: string; ip?: string }) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new ForbiddenException('Invalid credentials');

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'placeholder', // will update after RT is created
        refreshTokenExp: new Date(
          Date.now() + this.ms(process.env.JWT_REFRESH_TTL || '14d'),
        ),
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        device: dto.device ?? undefined,
        jti: randomUUID(),
      },
    });

    const accessToken = await this.tokens.signAccess({
      sub: user.id,
      sid: session.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await this.tokens.signRefresh({
      sub: user.id,
      sid: session.id,
      jti: session.jti || undefined,
    });

    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        loginCount: user.loginCount,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refresh(dto: RefreshDto) {
    // Decode first to get sid
    const decoded = await this.verifyRefreshSilently(dto.refreshToken);
    const sid = decoded.sid as number;

    const session = await this.prisma.session.findUnique({
      where: { id: sid },
    });
    if (!session || session.revokedAt)
      throw new ForbiddenException('Invalid session');

    // Check expiry in DB as extra gate
    if (session.refreshTokenExp < new Date())
      throw new ForbiddenException('Session expired');

    // Compare hash
    const ok = await argon2.verify(session.refreshTokenHash, dto.refreshToken);
    if (!ok) throw new ForbiddenException('Invalid refresh token');

    // Rotate RT (same session record, new hash + bump exp)
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || !user.isActive) throw new ForbiddenException('User disabled');

    const accessToken = await this.tokens.signAccess({
      sub: user.id,
      sid: session.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = await this.tokens.signRefresh({
      sub: user.id,
      sid: session.id,
      jti: session.jti || undefined,
    });

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await argon2.hash(newRefreshToken),
        refreshTokenExp: new Date(
          Date.now() + this.ms(process.env.JWT_REFRESH_TTL || '14d'),
        ),
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userIdParam: { sub: number }, refreshToken: string) {
    console.log('Logout called with userIdParam:', userIdParam);
    const userId = Number(userIdParam.sub); // 👈 normalize
    const decoded = await this.jwt.verifyAsync<{ sub: number; sid: number }>(
      refreshToken,
      { secret: process.env.JWT_REFRESH_SECRET! },
    );

    if (!decoded?.sub || Number(decoded.sub) !== userId) {
      throw new UnauthorizedException('Token/user mismatch');
    }

    const sid = Number(decoded.sid);
    if (!sid) throw new BadRequestException('Session id missing in token');

    await this.prisma.session.deleteMany({
      where: { id: sid, userId }, // both numeric
    });

    return { message: 'Logged out successfully' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        loginCount: true,
        avatarUrl: true,
        emailVerifiedAt: true,
      },
    });
    return user;
  }

  async updateAvatar(userId: number, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        loginCount: true,
        avatarUrl: true,
        emailVerifiedAt: true,
      },
    });
    return user;
  }

  async removeAvatar(userId: number) {
    // Load existing url to optionally delete the file
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        loginCount: true,
        avatarUrl: true,
        emailVerifiedAt: true,
      },
    });

    // Best-effort delete of local file if stored under /uploads
    try {
      const url = existing?.avatarUrl || '';
      if (url && url.startsWith('/uploads/avatars/')) {
        const { join } = await import('path');
        const { existsSync, unlinkSync } = await import('fs');
        const abs = join(process.cwd(), url.replace(/^\//, ''));
        if (existsSync(abs)) unlinkSync(abs);
      }
    } catch {}

    return updated;
  }

  private async verifyRefreshSilently(token: string) {
    try {
      return await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_REFRESH_SECRET!,
      });
    } catch {
      return null; // or rethrow if you prefer
    }
  }

  private ms(ttl: string) {
    // naive parser for "15m", "14d", "3600" (sec)
    const n = Number(ttl);
    if (!Number.isNaN(n)) return n * 1000;
    const m = ttl.match(/^(\d+)([smhd])$/i);
    if (!m) return 15 * 60 * 1000;
    const val = Number(m[1]);
    const unit = m[2].toLowerCase();
    const mult =
      unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return val * mult * 1000;
  }

  async signup(dto: SignupDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name ?? null,
          role: (dto.role as any) ?? 'TRAINEE', // you’ll pass ADMIN for your own account
          isEmailVerified: false,
          emailVerifiedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      return user;
    } catch (e: any) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw new BadRequestException('Could not create user');
    }
  }

  // ===== Password reset flow =====
  private resetTtlMinutes() {
    return parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '15', 10);
  }

  private generateToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // As requested, disclose when user doesn't exist
      throw new NotFoundException('No user with that email address.');
    }

    const { token, hash } = this.generateToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hash, // store hash for security
        passwordResetExpiresAt: new Date(Date.now() + this.resetTtlMinutes() * 60 * 1000),
      },
    });

    // Fire-and-forget email sending to avoid blocking response
    // UI can immediately show "Check your email" while email is dispatched.
    setImmediate(() => {
      try {
        const appName = process.env.APP_NAME || 'App';
        const resetUrl = this.buildResetLink(email, token);
        const from = process.env.MAIL_FROM || `no-reply@${new URL(resetUrl).hostname}`;
        const { subject, text, html } = buildPasswordResetEmail({
          appName,
          resetUrl,
          expiresMinutes: this.resetTtlMinutes(),
        });
        const mailer = this.ensureMailer();
        mailer
          .sendMail({ from, to: email, subject, text, html })
          .catch((err) => {
            // Log but do not affect the API response
            console.error('Failed to send reset email:', err?.message || err);
          });
      } catch (err: any) {
        // Log configuration/runtime errors without failing the request
        console.error('Error scheduling reset email:', err?.message || err);
      }
    });

    return { message: 'Reset instructions sent.' };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordResetToken || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Invalid or expired reset token.');
    }
    if (user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired.');
    }
    const hash = createHash('sha256').update(token).digest('hex');
    if (hash !== user.passwordResetToken) {
      throw new BadRequestException('Invalid reset token.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      }),
      // Optional: revoke all sessions for security
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    return { message: 'Password has been reset. Please sign in.' };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const ok = await bcrypt.compare(currentPassword || '', user.passwordHash);
    if (!ok) throw new ForbiddenException('Current password is incorrect.');
    if (!newPassword || newPassword.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.');
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    return { message: 'Password changed. Please sign in again.' };
  }
}
