import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AccessJwtPayload, RefreshJwtPayload } from './types/jwt.types';

@Injectable()
export class TokensService {
  constructor(private jwt: JwtService) {}

  async signAccess(payload: AccessJwtPayload) {
    const options: JwtSignOptions = {
      secret: process.env.JWT_ACCESS_SECRET!,
      // Some versions type expiresIn as number | StringValue; cast to satisfy template-literal type
      expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as unknown as any,
    };
    return this.jwt.signAsync(payload, options);
  }

  async signRefresh(payload: RefreshJwtPayload) {
    const options: JwtSignOptions = {
      secret: process.env.JWT_REFRESH_SECRET!,
      // Cast for the same reason as above
      expiresIn: (process.env.JWT_REFRESH_TTL ?? '14d') as unknown as any,
    };
    return this.jwt.signAsync(payload, options);
  }
}
