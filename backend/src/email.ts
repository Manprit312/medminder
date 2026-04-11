import nodemailer from 'nodemailer';

/**
 * Mail can be sent via:
 * 1) **Resend** — set `RESEND_API_KEY` (SMTP: smtp.resend.com, user `resend`, key as password), or
 * 2) **Generic SMTP** — set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.
 */
type ResolvedSmtp = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

function resolveSmtp(): ResolvedSmtp | null {
  const resend = process.env.RESEND_API_KEY?.trim();
  if (resend) {
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = port === 465 || port === 2465;
    return {
      host: 'smtp.resend.com',
      port,
      secure,
      user: 'resend',
      pass: resend,
    };
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || user === undefined || pass === undefined || String(pass).length === 0) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465 || port === 2465;
  return { host, port, secure, user, pass: String(pass) };
}

/** True when Resend API key or full generic SMTP env is set. */
export function isSmtpConfigured(): boolean {
  return resolveSmtp() !== null;
}

function createTransporter() {
  const opts = resolveSmtp();
  if (!opts) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }
  return nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: {
      user: opts.user,
      pass: opts.pass,
    },
  });
}

/** From header — Resend requires a verified domain or onboarding@resend.dev for testing. */
function mailFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) {
    return from;
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    return 'MedMinder <onboarding@resend.dev>';
  }
  const user = process.env.SMTP_USER?.trim();
  return user ? `"MedMinder" <${user}>` : '"MedMinder" <noreply@localhost>';
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = createTransporter();
  const from = mailFrom();
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your MedMinder password',
    text: `Someone requested a password reset for your MedMinder account.\n\nOpen this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Someone requested a password reset for your MedMinder account.</p><p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour).</p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

/**
 * Base URL of the Ionic web app (invite + password-reset links). No trailing slash.
 * Use **one** URL only. If `APP_PUBLIC_URL` is mistakenly a comma-separated list (e.g. CORS origins),
 * the **first** entry is used so links are not broken.
 */
export function publicAppUrl(): string {
  const fallback = 'http://localhost:8100';
  const raw = process.env.APP_PUBLIC_URL?.trim() ?? '';
  if (!raw) {
    return fallback;
  }
  const first = raw.split(',')[0]?.trim().replace(/\/$/, '') ?? '';
  return first || fallback;
}

export async function sendCaretakerInviteEmail(
  to: string,
  payload: { inviterHint: string; profileName: string; acceptUrl: string }
): Promise<void> {
  const transporter = createTransporter();
  const from = mailFrom();
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
  const transporter = createTransporter();
  const from = mailFrom();
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
