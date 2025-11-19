/**
 * Shared email utility for creating and managing SMTP transporter
 */
import nodemailer, { Transporter } from 'nodemailer';
import { getSmtpConfig } from './config';

let sharedTransporter: Transporter | null = null;

/**
 * Get or create the shared SMTP transporter instance
 */
export function getEmailTransporter(): Transporter {
  if (sharedTransporter) {
    return sharedTransporter;
  }

  const config = getSmtpConfig();
  sharedTransporter = nodemailer.createTransport(config);
  return sharedTransporter;
}

