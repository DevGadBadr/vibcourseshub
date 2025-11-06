import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class RequestVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;
}
