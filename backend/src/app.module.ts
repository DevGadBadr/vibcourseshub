import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { EmailVerificationModule } from './emailVerification/email.module.js';
import { ManagementModule } from './management/management.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    EmailVerificationModule,
    AuthModule,
    CoursesModule,
    ManagementModule,
    JwtModule.register({}),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
