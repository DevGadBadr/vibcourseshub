/**
 * Helper functions for session management
 */
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from '../tokens.service';

interface CreateSessionParams {
  userId: number;
  userAgent?: string;
  ip?: string;
  device?: string;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: number;
}

/**
 * Parse TTL string (e.g., "15m", "14d", "3600") to milliseconds
 */
function parseTtlToMs(ttl: string): number {
  const n = Number(ttl);
  if (!Number.isNaN(n)) return n * 1000;
  const m = ttl.match(/^(\d+)([smhd])$/i);
  if (!m) return 15 * 60 * 1000; // default 15 minutes
  const val = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return val * mult * 1000;
}

/**
 * Create a new session and generate tokens for a user
 */
export async function createUserSession(
  prisma: PrismaService,
  tokensService: TokensService,
  user: { id: number; email: string; role: string },
  params: CreateSessionParams,
): Promise<SessionTokens> {
  const refreshTtl = process.env.JWT_REFRESH_TTL || '14d';
  const refreshExp = new Date(Date.now() + parseTtlToMs(refreshTtl));

  // Create session with placeholder hash (will update after RT is created)
  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      refreshTokenHash: 'placeholder',
      refreshTokenExp: refreshExp,
      userAgent: params.userAgent,
      ip: params.ip,
      device: params.device ?? undefined,
      jti: randomUUID(),
    },
  });

  // Generate tokens
  const accessToken = await tokensService.signAccess({
    sub: user.id,
    sid: session.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = await tokensService.signRefresh({
    sub: user.id,
    sid: session.id,
    jti: session.jti || undefined,
  });

  // Update session with actual refresh token hash
  const refreshTokenHash = await argon2.hash(refreshToken);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash },
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
  };
}

/**
 * Update user login stats
 */
export async function updateUserLoginStats(
  prisma: PrismaService,
  userId: number,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
      isLoggedIn: true,
    },
  });
}

