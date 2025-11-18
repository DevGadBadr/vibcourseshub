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

  @IsOptional()
  @IsString()
  @MinLength(4)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // New extended fields
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  fullDescription?: string;

  @IsOptional()
  @IsUrl()
  previewVideoUrl?: string;

  @IsOptional()
  @IsUrl()
  brochureUrl?: string;

  @IsOptional()
  @IsArray()
  subtitleLanguages?: string[];

  @IsOptional()
  @IsArray()
  labels?: string[];

  @IsOptional()
  @IsString()
  currency?: string;

  // Incoming simple array of learning outcome texts ("What you'll learn")
  @IsOptional()
  @IsArray()
  whatYouWillLearn?: string[];

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
