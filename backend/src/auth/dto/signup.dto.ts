import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum AllowedSignupRole {
  TRAINEE = 'TRAINEE',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  // optional: allow selecting role for the very first bootstrap;
  // later you should restrict this to admins only.
  @IsOptional()
  @IsEnum(AllowedSignupRole)
  role?: AllowedSignupRole;
}
