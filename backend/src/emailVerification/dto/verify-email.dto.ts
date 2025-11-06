import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
