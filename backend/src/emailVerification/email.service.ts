import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { buildVerificationEmail } from './email.templates';

function now() {
  return new Date();
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

@Injectable()
export class EmailVerificationService {
  private transporter: Transporter | null = null;
  private readonly tokenExpiryMinutes = parseInt(process.env.VERIFY_TOKEN_TTL_MINUTES || '15', 10);
  private readonly resendCooldownSeconds = parseInt(process.env.VERIFY_RESEND_COOLDOWN_SECONDS || '60', 10);
  private readonly maxSendsPerHour = parseInt(process.env.VERIFY_MAX_SENDS_PER_HOUR || '5', 10);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: any,
  ) {}

  private ensureTransporter() {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return this.transporter;
  }

  private async sendVerificationEmail(to: string, link: string) {
    const appName = process.env.APP_NAME || 'App';
    const from = process.env.MAIL_FROM || `no-reply@${new URL(link).hostname}`;
    const { subject, text, html } = buildVerificationEmail({
      appName,
      verifyUrl: link,
      expiresMinutes: this.tokenExpiryMinutes,
    });
    const transporter = this.ensureTransporter();
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
      throw new HttpException('Please wait before requesting another email.', HttpStatus.TOO_MANY_REQUESTS);
    }
  const count = ((await this.cache.get(keyHourly)) as number) || 0;
    if (count >= this.maxSendsPerHour) {
      throw new HttpException('Too many requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.cache.set(keyCooldown, 1, this.resendCooldownSeconds * 1000);
    await this.cache.set(keyHourly, count + 1, 60 * 60 * 1000);
  }

  private buildVerifyLink(email: string, token: string) {
    const base = process.env.VERIFY_EMAIL_URL || process.env.FRONTEND_URL || 'http://localhost:3000/verify-email';
    const url = new URL(base);
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
        verificationTokenExpiresAt: minutesFromNow(this.tokenExpiryMinutes),
      },
    });

    const link = this.buildVerifyLink(email, token);
    console.log('Verification link (for testing):', link);
    await this.sendVerificationEmail(email, link);
  }

  async resend(email: string) {
    return this.requestVerification(email);
  }

  async verify(email: string, token: string): Promise<boolean> {
    
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.verificationTokenHash || !user.verificationTokenExpiresAt) return false;
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
