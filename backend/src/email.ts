import nodemailer from 'nodemailer';

/** True when SMTP env is set enough to send mail (production deployments). */
export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER !== undefined &&
      process.env.SMTP_PASS !== undefined &&
      String(process.env.SMTP_PASS).length > 0
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const from =
    process.env.EMAIL_FROM?.trim() || `"MedMinder" <${process.env.SMTP_USER}>`;
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your MedMinder password',
    text: `Someone requested a password reset for your MedMinder account.\n\nOpen this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Someone requested a password reset for your MedMinder account.</p><p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour).</p><p>If you did not request this, you can ignore this email.</p>`,
  });
}
