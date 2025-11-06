import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { SignupDto } from './dto/signup.dto';
import { TokensService } from './tokens.service';
gogo

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokens: TokensService,
  ) {}

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
          id: true, email: true, name: true, role: true, createdAt: true,
        },
      });

      return user;
    } catch (e: any) {
      if (e && typeof e === 'object' && 'code' in e && (e as any).code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw new BadRequestException('Could not create user');
    }
  }
  
}
