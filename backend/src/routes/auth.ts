import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { asyncRoute } from '../async-route.js';
import { forgotPasswordLimiter, resetPasswordLimiter } from '../auth-rate-limit.js';
import { queryOne, runExec } from '../db.js';
import { isSmtpConfigured, sendPasswordResetEmail } from '../email.js';
import type { AuthPayload } from '../middleware/auth.js';

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

/** Base URL of the Ionic web app (used in password-reset emails). No trailing slash. */
function publicAppUrl(): string {
  const raw = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '');
  return raw || 'http://localhost:8100';
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
    await runExec('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)', [
      id,
      email,
      hash,
      now,
    ]);
    const token = jwt.sign({ sub: id, email } satisfies AuthPayload, jwtSecret(), { expiresIn: '30d' });
    res.status(201).json({ token, user: { id, email } });
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
    const token = jwt.sign({ sub: row.id, email: row.email } satisfies AuthPayload, jwtSecret(), {
      expiresIn: '30d',
    });
    res.json({ token, user: { id: row.id, email: row.email } });
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
      const u = await queryOne<{ id: string; email: string; created_at: string }>(
        'SELECT id, email, created_at FROM users WHERE id = ?',
        [decoded.sub]
      );
      if (!u) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user: u });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  })
);
