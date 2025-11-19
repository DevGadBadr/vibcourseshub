/**
 * Configuration helpers for environment variables
 */

export function getCorsOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map((origin) => origin.trim());
  }
  return [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://devgadbadr.com:8081',
    'https://devgadbadr.com:8081',
    'https://localhost:8081',
    'https://127.0.0.1:8081',
  ];
}

export function getServerPort(): number {
  return parseInt(process.env.PORT || '3010', 10);
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP configuration missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS',
    );
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  };
}

export function getGoogleClientIds(): string[] {
  const rawIds =
    process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '';
  return rawIds
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAppName(): string {
  return process.env.APP_NAME || 'App';
}

export function getMailFrom(): string {
  return process.env.MAIL_FROM || 'no-reply@example.com';
}

export function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.RESET_PASSWORD_URL ||
    'http://devgadbadr.com:3010'
  );
}

export function getResetPasswordUrl(): string {
  const base = process.env.RESET_PASSWORD_URL || getFrontendUrl();
  const url = new URL(base);
  const normalized = url.pathname?.trim() || '/';
  const hasReset = /\/reset-password\/?$/i.test(normalized);
  if (!hasReset) {
    const basePath = normalized === '/' ? '' : normalized.replace(/\/$/, '');
    url.pathname = `${basePath}/reset-password`;
  }
  return url.toString();
}

export function getVerifyEmailUrl(): string {
  const base =
    process.env.VERIFY_EMAIL_URL ||
    process.env.FRONTEND_URL ||
    'http://devgadbadr.com:3010';
  const url = new URL(base);
  const normalizedPath = url.pathname?.trim() || '/';
  const hasExplicitVerifyPath = /\/verify-email\/?$/i.test(normalizedPath);
  if (!hasExplicitVerifyPath) {
    const basePath =
      normalizedPath === '/' ? '' : normalizedPath.replace(/\/$/, '');
    url.pathname = `${basePath}/verify-email`;
  }
  return url.toString();
}

export function getPaymentSuccessUrl(): string {
  return (
    process.env.PAYMENT_SUCCESS_URL ||
    'https://example.com/payment-success'
  );
}

export function getPaymentCancelUrl(): string {
  return (
    process.env.PAYMENT_CANCEL_URL || 'https://example.com/payment-cancel'
  );
}

