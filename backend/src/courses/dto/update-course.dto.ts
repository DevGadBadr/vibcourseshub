import { CourseLevel } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

// Update DTO with validation decorators so ValidationPipe allows fields
export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Extended fields
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  fullDescription?: string;

  @IsOptional()
  @IsUrl()
  previewVideoUrl?: string | null;

  @IsOptional()
  @IsUrl()
  brochureUrl?: string | null;

  @IsOptional()
  @IsInt()
  instructorId?: number;

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

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // Full replacement list for categories (optional)
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoriesIds?: number[];

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

  @IsOptional()
  @IsString()
  currency?: string;
}
