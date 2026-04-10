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

/** Base URL of the Ionic web app (invite links). */
export function publicAppUrl(): string {
  const raw = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '');
  return raw || 'http://localhost:8100';
}

export async function sendCaretakerInviteEmail(
  to: string,
  payload: { inviterHint: string; profileName: string; acceptUrl: string }
): Promise<void> {
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
  const { inviterHint, profileName, acceptUrl } = payload;
  await transporter.sendMail({
    from,
    to,
    subject: `MedMinder — care invite for ${profileName}`,
    text: `${inviterHint} invited you to follow medication adherence for ${profileName} in MedMinder.\n\nOpen this link to accept (sign in with this email):\n${acceptUrl}\n\nIf you did not expect this, you can ignore this email.`,
    html: `<p>${inviterHint} invited you to follow medication adherence for <strong>${profileName}</strong> in MedMinder.</p><p><a href="${acceptUrl}">Accept invitation</a> — sign in with this email address.</p><p>If you did not expect this, you can ignore this email.</p>`,
  });
}

export async function sendCaretakerDoseAlertEmail(
  to: string,
  payload: {
    profileName: string;
    medicationName: string;
    date: string;
    scheduledTime: string;
    statusLabel: string;
  }
): Promise<void> {
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
  const { profileName, medicationName, date, scheduledTime, statusLabel } = payload;
  const subj = `MedMinder — ${profileName}: dose ${statusLabel}`;
  const body = `Dose update for ${profileName}:\n${medicationName} on ${date} at ${scheduledTime} was marked ${statusLabel}.\n\nOpen the MedMinder app for details.`;
  await transporter.sendMail({
    from,
    to,
    subject: subj,
    text: body,
    html: `<p><strong>${profileName}</strong></p><p>${medicationName} on ${date} at ${scheduledTime} was marked <strong>${statusLabel}</strong>.</p><p>Open the MedMinder app for details.</p>`,
  });
}
