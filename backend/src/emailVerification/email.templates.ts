export function buildVerificationEmail(options: {
  appName: string;
  verifyUrl: string;
  expiresMinutes: number;
}) {
  const { appName, verifyUrl, expiresMinutes } = options;
  const subject = `[${appName}] Verify your email address`;
  const text = `Welcome to ${appName}!

Please verify your email address by clicking the link below:

${verifyUrl}

This link will expire in ${expiresMinutes} minutes.
If you did not create an account, you can ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Welcome to ${appName}!</h2>
      <p>Please verify your email address by clicking the button below.</p>
      <p>
        <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p style="color:#6b7280;font-size:12px;">This link will expire in ${expiresMinutes} minutes.</p>
    </div>
  `;
  return { subject, text, html };
}
