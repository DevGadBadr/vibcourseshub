import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getEmailTransporter } from '../common/email.util';
import {
  getAppName,
  getMailFrom,
  getVerifyEmailUrl,
} from '../common/config';
import {
  VERIFY_MAX_SENDS_PER_HOUR,
  VERIFY_RESEND_COOLDOWN_SECONDS,
  VERIFY_TOKEN_TTL_MINUTES,
} from '../common/constants';
import { buildVerificationEmail } from './email.templates';

function now() {
  return new Date();
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: any,
  ) {}

  private async sendVerificationEmail(to: string, link: string) {
    const appName = getAppName();
    const from = getMailFrom();
    const { subject, text, html } = buildVerificationEmail({
      appName,
      verifyUrl: link,
      expiresMinutes: VERIFY_TOKEN_TTL_MINUTES,
    });
    const transporter = getEmailTransporter();
    await transporter.sendMail({ from, to, subject, text, html });
  }

  private generateToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }

  private async checkRateLimit(email: string) {
    const keyCooldown = `verif:cooldown:${email}`;
    const keyHourly = `verif:hour:${email}`;
    const hasCooldown = await this.cache.get(keyCooldown);
    if (hasCooldown) {
      throw new HttpException(
        'Please wait before requesting another email.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const count = ((await this.cache.get(keyHourly)) as number) || 0;
    if (count >= VERIFY_MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        'Too many requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.cache.set(
      keyCooldown,
      1,
      VERIFY_RESEND_COOLDOWN_SECONDS * 1000,
    );
    await this.cache.set(keyHourly, count + 1, 60 * 60 * 1000);
  }

  private buildVerifyLink(email: string, token: string): string {
    const baseUrl = getVerifyEmailUrl();
    const url = new URL(baseUrl);
    url.searchParams.set('email', email);
    url.searchParams.set('token', token);
    return url.toString();
  }

  async requestVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always act like it works to avoid enumeration
    if (!user) return;
    if (user.isEmailVerified) return;

    await this.checkRateLimit(email);

    const { token, hash } = this.generateToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: hash,
        verificationTokenExpiresAt: minutesFromNow(VERIFY_TOKEN_TTL_MINUTES),
      },
    });

    const link = this.buildVerifyLink(email, token);
    console.log('Verification link (for testing):', link);

    // Fire-and-forget email sending to avoid blocking the response
    setImmediate(() => {
      this
        .sendVerificationEmail(email, link)
        .catch((err) => {
          console.error('Failed to send verification email:', err?.message || err);
        });
    });
  }

  async resend(email: string) {
    return this.requestVerification(email);
  }

  async verify(email: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.verificationTokenHash ||
      !user.verificationTokenExpiresAt
    )
      return false;
    const nowDt = now();
    if (user.verificationTokenExpiresAt < nowDt) return false;
    const hash = createHash('sha256').update(token).digest('hex');
    if (hash !== user.verificationTokenHash) return false;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: nowDt,
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      },
    });
    return true;
  }
}
