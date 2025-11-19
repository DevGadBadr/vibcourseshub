/**
 * Application-wide constants and configuration values
 */

export const CORS_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://devgadbadr.com:8081',
  'https://devgadbadr.com:8081',
  'https://localhost:8081',
  'https://127.0.0.1:8081',
];

export const DEFAULT_PORT = 3010;

export const PASSWORD_SALT_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 8;

export const RESET_TOKEN_TTL_MINUTES = parseInt(
  process.env.RESET_TOKEN_TTL_MINUTES || '15',
  10,
);

export const VERIFY_TOKEN_TTL_MINUTES = parseInt(
  process.env.VERIFY_TOKEN_TTL_MINUTES || '15',
  10,
);

export const VERIFY_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.VERIFY_RESEND_COOLDOWN_SECONDS || '60',
  10,
);

export const VERIFY_MAX_SENDS_PER_HOUR = parseInt(
  process.env.VERIFY_MAX_SENDS_PER_HOUR || '5',
  10,
);

export const FILE_UPLOAD_LIMITS = {
  AVATAR_MAX_SIZE: 2 * 1024 * 1024, // 2MB
  THUMBNAIL_MAX_SIZE: 3 * 1024 * 1024, // 3MB
  BROCHURE_MAX_SIZE: 15 * 1024 * 1024, // 15MB
} as const;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export const ALLOWED_PDF_TYPES = ['application/pdf'] as const;

export const DEFAULT_PAGINATION_TAKE = 20;
export const MAX_PAGINATION_TAKE = 50;

