// src/auth/auth.controller.ts
import { BadRequestException, Body, Controller, Get, HttpCode, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
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
}
