import { CourseLevel } from '@prisma/client';
import {
    IsArray,
    IsBoolean,
    IsEmail,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    MinLength,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(4)
  title!: string;

  @IsString()
  @MinLength(4)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  instructorId?: number; // Optionally select by id

  @IsOptional()
  @IsEmail()
  instructorEmail?: string; // Or by email; will be created as INSTRUCTOR if missing

  // Optional: additional instructors (co-instructors)
  @IsOptional()
  @IsArray()
  instructorsIds?: number[];

  // Optional: categories to assign
  @IsOptional()
  @IsArray()
  categoriesIds?: number[];

  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsUrl()
  promoUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // Pricing
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  discountPrice?: number | null;

  @IsOptional()
  @IsBoolean()
  showPrice?: boolean;
}
