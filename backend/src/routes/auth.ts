import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { asyncRoute } from '../async-route.js';
import { forgotPasswordLimiter, resetPasswordLimiter } from '../auth-rate-limit.js';
import { queryOne, runExec } from '../db.js';
import { isSmtpConfigured, publicAppUrl, sendPasswordResetEmail } from '../email.js';
import type { AuthPayload } from '../middleware/auth.js';
import { hashOtp, randomOtpCode, verifyOtp } from '../otp-crypto.js';
import { sendOtpSms } from '../otp-sms.js';
import { normalizePhoneE164 } from '../phone.js';

export const authRouter = Router();

const SALT_ROUNDS = 10;

const GENERIC_FORGOT_RESPONSE = {
  ok: true,
  message: 'If that email is registered, you will receive reset instructions shortly.',
};

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 chars)');
  }
  return s;
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

authRouter.post(
  '/register',
  asyncRoute(async (req, res) => {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'Valid email and password (min 8 chars) required' });
      return;
    }
    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const id = uuid();
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const now = new Date().toISOString();
    await runExec(
      'INSERT INTO users (id, email, password_hash, created_at, subscription_tier) VALUES (?, ?, ?, ?, ?)',
      [id, email, hash, now, 'free']
    );
    const token = jwt.sign(
      { sub: id, email, phone: undefined } satisfies AuthPayload,
      jwtSecret(),
      { expiresIn: '30d' }
    );
    res.status(201).json({
      token,
      user: { id, email, phone: null, subscriptionTier: 'free' },
    });
  })
);

authRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    const row = await queryOne<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email]
    );
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const full = await queryOne<{ id: string; email: string; phone: string | null }>(
      'SELECT id, email, phone FROM users WHERE id = ?',
      [row.id]
    );
    const phone = full?.phone?.trim() || undefined;
    const token = jwt.sign(
      { sub: row.id, email: row.email, phone } satisfies AuthPayload,
      jwtSecret(),
      {
        expiresIn: '30d',
      }
    );
    const tierRow = await queryOne<{ subscription_tier: string }>(
      'SELECT subscription_tier FROM users WHERE id = ?',
      [row.id]
    );
    const subscriptionTier = tierRow?.subscription_tier === 'premium' ? 'premium' : 'free';
    res.json({ token, user: { id: row.id, email: row.email, phone: phone ?? null, subscriptionTier } });
  })
);

const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_TTL_MS = 10 * 60 * 1000;

function syntheticEmailForPhone(phone: string): string {
  return `phone-${phone.replace(/\+/g, '')}@otp.medminder.internal`;
}

function issueTokenForUser(u: { id: string; email: string; phone: string | null; subscription_tier: string | null }): {
  token: string;
  subscriptionTier: 'free' | 'premium';
} {
  const subscriptionTier = u.subscription_tier === 'premium' ? 'premium' : 'free';
  const phone = u.phone?.trim() || undefined;
  const token = jwt.sign(
    { sub: u.id, email: u.email, phone } satisfies AuthPayload,
    jwtSecret(),
    { expiresIn: '30d' }
  );
  return { token, subscriptionTier };
}

/** Request SMS OTP; pair with POST /otp/verify */
authRouter.post(
  '/otp/request',
  asyncRoute(async (req, res) => {
    const phone = normalizePhoneE164(String(req.body?.phone ?? ''));
    if (!phone) {
      res.status(400).json({ error: 'Valid phone number required' });
      return;
    }
    const existing = await queryOne<{ created_at: string }>(
      'SELECT created_at FROM auth_otp WHERE phone = ?',
      [phone]
    );
    if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age < OTP_RESEND_COOLDOWN_MS) {
        res.status(429).json({ error: 'Please wait a moment before requesting a new code.' });
        return;
      }
    }
    const code = randomOtpCode();
    const codeHash = hashOtp(phone, code);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await runExec('DELETE FROM auth_otp WHERE phone = ?', [phone]);
    await runExec(
      'INSERT INTO auth_otp (phone, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [phone, codeHash, expiresAt, now]
    );
    await sendOtpSms(phone, code);
    const exposeOtp = process.env.DEV_EXPOSE_OTP === '1' || process.env.NODE_ENV !== 'production';
    res.json({
      ok: true,
      message: 'We sent a sign-in code to this number (when SMS is configured).',
      ...(exposeOtp ? { devOtp: code } : {}),
    });
  })
);

/** Verify OTP: creates account on first success */
authRouter.post(
  '/otp/verify',
  asyncRoute(async (req, res) => {
    const phone = normalizePhoneE164(String(req.body?.phone ?? ''));
    const code = String(req.body?.code ?? '').replace(/\D/g, '');
    if (!phone || code.length !== 6) {
      res.status(400).json({ error: 'Valid phone and 6-digit code required' });
      return;
    }
    const row = await queryOne<{ code_hash: string; expires_at: string }>(
      'SELECT code_hash, expires_at FROM auth_otp WHERE phone = ?',
      [phone]
    );
    if (!row) {
      res.status(401).json({ error: 'No code pending for this number. Request a new code.' });
      return;
    }
    if (new Date(row.expires_at) <= new Date()) {
      await runExec('DELETE FROM auth_otp WHERE phone = ?', [phone]);
      res.status(401).json({ error: 'Code expired. Request a new one.' });
      return;
    }
    if (!verifyOtp(phone, code, row.code_hash)) {
      res.status(401).json({ error: 'Invalid code' });
      return;
    }
    await runExec('DELETE FROM auth_otp WHERE phone = ?', [phone]);

    let user = await queryOne<{
      id: string;
      email: string;
      phone: string | null;
      password_hash: string;
      subscription_tier: string | null;
    }>('SELECT id, email, phone, password_hash, subscription_tier FROM users WHERE phone = ?', [phone]);

    if (!user) {
      const id = uuid();
      const now = new Date().toISOString();
      const synthetic = syntheticEmailForPhone(phone);
      const used = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [synthetic]);
      if (used) {
        res.status(409).json({ error: 'Account conflict. Contact support.' });
        return;
      }
      const password_hash = bcrypt.hashSync(`otp-only|${id}|${now}`, SALT_ROUNDS);
      await runExec(
        'INSERT INTO users (id, email, password_hash, created_at, subscription_tier, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [id, synthetic, password_hash, now, 'free', phone]
      );
      user = {
        id,
        email: synthetic,
        phone,
        password_hash,
        subscription_tier: 'free',
      };
    }

    const { token, subscriptionTier } = issueTokenForUser({
      id: user.id,
      email: user.email,
      phone: user.phone,
      subscription_tier: user.subscription_tier,
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        subscriptionTier,
      },
    });
  })
);

authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  asyncRoute(async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }
  const user = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]);

  if (!user) {
    res.json(GENERIC_FORGOT_RESPONSE);
    return;
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const rowId = uuid();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  await runExec('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
  await runExec(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [rowId, user.id, tokenHash, expiresAt, createdAt]
  );

  const resetUrl = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  if (isSmtpConfigured()) {
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      console.error('[auth] sendPasswordResetEmail failed:', err);
      res.status(503).json({ error: 'Could not send reset email. Try again later.' });
      return;
    }
    res.json(GENERIC_FORGOT_RESPONSE);
    return;
  }

  console.warn('[auth] SMTP not configured — password reset link (use within 1 hour):');
  console.warn(resetUrl);
  if (process.env.DEV_EXPOSE_RESET_URL === 'true') {
    res.json({ ...GENERIC_FORGOT_RESPONSE, devResetUrl: resetUrl });
    return;
  }
  res.json(GENERIC_FORGOT_RESPONSE);
  })
);

authRouter.post(
  '/reset-password',
  resetPasswordLimiter,
  asyncRoute(async (req, res) => {
    const token = String(req.body?.token ?? '');
    const password = String(req.body?.password ?? '');
    if (!token || !password || password.length < 8) {
      res.status(400).json({ error: 'Valid token and password (min 8 chars) required' });
      return;
    }
    const tokenHash = hashResetToken(token);
    const row = await queryOne<{ id: string; user_id: string; expires_at: string }>(
      `SELECT t.id, t.user_id, t.expires_at FROM password_reset_tokens t WHERE t.token_hash = ?`,
      [tokenHash]
    );

    if (!row || new Date(row.expires_at) <= new Date()) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    await runExec('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
    await runExec('DELETE FROM password_reset_tokens WHERE user_id = ?', [row.user_id]);

    res.json({ ok: true, message: 'Password updated. You can sign in now.' });
  })
);

authRouter.get(
  '/me',
  asyncRoute(async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const decoded = jwt.verify(header.slice(7), jwtSecret()) as AuthPayload;
      const u = await queryOne<{
        id: string;
        email: string;
        phone: string | null;
        created_at: string;
        subscription_tier: string | null;
      }>('SELECT id, email, phone, created_at, subscription_tier FROM users WHERE id = ?', [decoded.sub]);
      if (!u) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const subscriptionTier = u.subscription_tier === 'premium' ? 'premium' : 'free';
      res.json({
        user: {
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at,
          subscriptionTier,
        },
      });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  })
);
