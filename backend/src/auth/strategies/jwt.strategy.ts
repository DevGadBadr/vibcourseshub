import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessJwtPayload } from '../types/jwt.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }
  async validate(payload: AccessJwtPayload) {
    // Require session id to support revocation by deleting session row
    if (!payload.sid) {
      throw new UnauthorizedException('Session missing');
    }
    const session = await this.prisma.session.findUnique({
      where: { id: Number(payload.sid) },
    });
    if (!session || session.revokedAt || session.refreshTokenExp < new Date()) {
      throw new UnauthorizedException('Session invalid');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: Number(payload.sub) },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive');
    }
    return payload; // include sid so downstream can access it if needed
  }
}
