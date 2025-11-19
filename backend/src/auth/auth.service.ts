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
import { createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { join } from 'path';
import { buildPasswordResetEmail } from '../emailVerification/email.templates.js';
import { getEmailTransporter } from '../common/email.util.js';
import {
    getAppName,
    getGoogleClientIds,
    getMailFrom,
    getResetPasswordUrl,
} from '../common/config.js';
import { PASSWORD_SALT_ROUNDS, RESET_TOKEN_TTL_MINUTES } from '../common/constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createUserSession, updateUserLoginStats } from './helpers/session.helper.js';
import { formatUserResponse } from './helpers/user-response.helper.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { SignupDto } from './dto/signup.dto';
import { TokensService } from './tokens.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokens: TokensService,
    private jwt: JwtService,
  ) {}

  private buildResetLink(email: string, token: string): string {
    const baseUrl = getResetPasswordUrl();
    const url = new URL(baseUrl);
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

    const { accessToken, refreshToken } = await createUserSession(
      this.prisma,
      this.tokens,
      user,
      {
        userId: user.id,
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        device: dto.device,
      },
    );

    await updateUserLoginStats(this.prisma, user.id);

    return {
      accessToken,
      refreshToken,
      user: formatUserResponse(user),
    };
  }

  // --- Google social login ---
  async googleLogin(
    idToken: string,
    meta?: { userAgent?: string; ip?: string },
  ) {
    const audiences = getGoogleClientIds();
    if (!audiences.length) {
      throw new BadRequestException('Google client ID(s) not configured');
    }
    if (!idToken) throw new BadRequestException('Missing Google idToken');

    // Try verification against any configured audience (web, android, ios).
    let payload: any = null;
    let lastError: any = null;
    for (const aud of audiences) {
      const oauthClient = new OAuth2Client(aud);
      try {
        const ticket = await oauthClient.verifyIdToken({ idToken, audience: aud });
        payload = ticket.getPayload();
        if (payload) break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!payload) {
      console.warn('Google ID token verification failed:', lastError?.message || lastError);
      throw new UnauthorizedException('Invalid Google identity token');
    }
    if (!payload) throw new UnauthorizedException('Invalid Google token payload');

    const sub = payload.sub as string | undefined;
    const email = (payload.email as string | undefined)?.toLowerCase();
    const name = payload.name as string | undefined;
    const picture = payload.picture as string | undefined;
    const emailVerified = Boolean(payload.email_verified);
    if (!sub || !email) {
      throw new UnauthorizedException('Google account missing id or email');
    }

    // Find or create user
    // Transactional upsert logic to avoid race conditions
    let user = await this.prisma.$transaction(async (tx) => {
      const existingGoogle = await tx.user.findUnique({ where: { googleId: sub } });
      if (existingGoogle) {
        return await tx.user.update({
          where: { id: existingGoogle.id },
          data: {
            googlePicture: picture ?? existingGoogle.googlePicture ?? undefined,
            googleEmailVerified: emailVerified,
            provider: 'google',
            name: existingGoogle.name ?? name ?? undefined,
            isEmailVerified: existingGoogle.isEmailVerified || emailVerified,
            emailVerifiedAt: existingGoogle.emailVerifiedAt || (emailVerified ? new Date() : null),
            avatarUrl: existingGoogle.avatarUrl || picture || existingGoogle.googlePicture || null,
          },
        });
      }
      // Try matching by email
      const byEmail = await tx.user.findUnique({ where: { email } });
      if (byEmail) {
        return await tx.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: sub,
            googlePicture: picture ?? byEmail.googlePicture ?? undefined,
            googleEmailVerified: emailVerified,
            provider: 'google',
            name: byEmail.name ?? name ?? undefined,
            isEmailVerified: byEmail.isEmailVerified || emailVerified,
            emailVerifiedAt: byEmail.emailVerifiedAt || (emailVerified ? new Date() : null),
            avatarUrl: byEmail.avatarUrl || picture || null,
          },
        });
      }
      // Create new user
      const randomPwd = randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPwd, PASSWORD_SALT_ROUNDS);
      return await tx.user.create({
        data: {
          email,
          passwordHash,
          name: name ?? null,
          role: 'TRAINEE',
          googleId: sub,
          googlePicture: picture ?? null,
          googleEmailVerified: emailVerified,
          provider: 'google',
          isEmailVerified: emailVerified,
          emailVerifiedAt: emailVerified ? new Date() : null,
          avatarUrl: picture ?? null,
        },
      });
    });

    // Optionally download avatar file locally for consistency
    const fetchAvatar = (process.env.GOOGLE_FETCH_AVATAR || 'false').toLowerCase() === 'true';
    if (fetchAvatar && picture && (!user.avatarUrl || user.avatarUrl === picture)) {
      try {
        const res = await fetch(picture);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          const ext = picture.match(/\.([a-zA-Z0-9]+)(?:$|[?])/)?.[1] || 'jpg';
          const dir = join(process.cwd(), 'uploads', 'avatars');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          const fileName = `g_${sub}_${Date.now()}.${ext}`;
          const fullPath = join(dir, fileName);
          writeFileSync(fullPath, buffer);
          const relPath = `/uploads/avatars/${fileName}`;
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: relPath },
          });
        }
      } catch (e) {
        console.warn('Failed to download Google avatar:', (e as any)?.message || e);
      }
    }

    // Create session and issue tokens (same flow as password login)
    const { accessToken, refreshToken } = await createUserSession(
      this.prisma,
      this.tokens,
      user,
      {
        userId: user.id,
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        device: 'google',
      },
    );

    await updateUserLoginStats(this.prisma, user.id);

    return {
      accessToken,
      refreshToken,
      user: formatUserResponse({ ...user, provider: user.provider || 'google' }),
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
          Date.now() + this.parseTtlToMs(process.env.JWT_REFRESH_TTL || '14d'),
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
    // If no sessions remain for this user, set isLoggedIn to false
    const remaining = await this.prisma.session.count({ where: { userId } });
    if (remaining === 0) {
      await this.prisma.user.update({ where: { id: userId }, data: { isLoggedIn: false } });
    }

    return { message: 'Logged out successfully' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        loginCount: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        provider: true,
        googlePicture: true,
        googleId: true,
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
      return null;
    }
  }

  private parseTtlToMs(ttl: string): number {
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
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name ?? null,
          title: dto.title ?? null,
          role: (dto.role as any) ?? 'TRAINEE', // you’ll pass ADMIN for your own account
          isEmailVerified: false,
          emailVerifiedAt: null,
          provider: 'local',
        },
        select: {
          id: true,
          email: true,
          name: true,
          title: true,
          role: true,
          createdAt: true,
          provider: true,
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
        passwordResetExpiresAt: new Date(
          Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
        ),
      },
    });

    // Fire-and-forget email sending to avoid blocking response
    setImmediate(() => {
      try {
        const appName = getAppName();
        const resetUrl = this.buildResetLink(email, token);
        const from = getMailFrom();
        const { subject, text, html } = buildPasswordResetEmail({
          appName,
          resetUrl,
          expiresMinutes: RESET_TOKEN_TTL_MINUTES,
        });
        const mailer = getEmailTransporter();
        mailer
          .sendMail({ from, to: email, subject, text, html })
          .catch((err) => {
            console.error('Failed to send reset email:', err?.message || err);
          });
      } catch (err: any) {
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
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
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
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    return { message: 'Password changed. Please sign in again.' };
  }
}
