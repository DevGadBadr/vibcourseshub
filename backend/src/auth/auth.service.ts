import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt/dist/index.js';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import 'dotenv/config';
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
}
