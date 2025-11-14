import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  token!: string;

  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
