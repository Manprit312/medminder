import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { asyncRoute } from '../async-route.js';
import { queryOne, runExec } from '../db.js';
import { verifyFirebaseIdToken } from '../firebase-admin.js';
import type { AuthPayload } from '../middleware/auth.js';

export const authRouter = Router();

const SALT_ROUNDS = 10;

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 chars)');
  }
  return s;
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

function syntheticPasswordForSocialAccount(userId: string): string {
  return bcrypt.hashSync(`social-only|${userId}|${Date.now()}`, SALT_ROUNDS);
}

function rejectLegacyAuth(res: { status: (n: number) => { json: (b: unknown) => void } }): void {
  res.status(410).json({ error: 'Only Google sign-in is enabled for this app.' });
}

authRouter.post(
  '/register',
  asyncRoute(async (_req, res) => {
    rejectLegacyAuth(res);
  })
);

authRouter.post(
  '/login',
  asyncRoute(async (_req, res) => {
    rejectLegacyAuth(res);
  })
);

authRouter.post(
  '/otp/request',
  asyncRoute(async (_req, res) => {
    rejectLegacyAuth(res);
  })
);

authRouter.post(
  '/otp/verify',
  asyncRoute(async (_req, res) => {
    rejectLegacyAuth(res);
  })
);

authRouter.post(
  '/forgot-password',
  asyncRoute(async (_req, res) => {
    rejectLegacyAuth(res);
  })
);

authRouter.post(
  '/reset-password',
  asyncRoute(async (_req, res) => {
    rejectLegacyAuth(res);
  })
);

/** Firebase Google sign-in: client sends Firebase ID token. */
authRouter.post(
  '/google',
  asyncRoute(async (req, res) => {
    const idToken = String(req.body?.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ error: 'idToken required' });
      return;
    }
    const decoded = await verifyFirebaseIdToken(idToken);
    const provider = decoded.firebase?.sign_in_provider;
    if (provider !== 'google.com') {
      res.status(403).json({ error: 'Google sign-in token required' });
      return;
    }
    const email = decoded.email?.trim().toLowerCase();
    if (!email || !decoded.email_verified) {
      res.status(400).json({ error: 'Verified Google email required' });
      return;
    }

    let user = await queryOne<{
      id: string;
      email: string;
      phone: string | null;
      subscription_tier: string | null;
    }>('SELECT id, email, phone, subscription_tier FROM users WHERE email = ?', [email]);

    if (!user) {
      const id = uuid();
      const now = new Date().toISOString();
      const passwordHash = syntheticPasswordForSocialAccount(id);
      await runExec(
        'INSERT INTO users (id, email, password_hash, created_at, subscription_tier) VALUES (?, ?, ?, ?, ?)',
        [id, email, passwordHash, now, 'free']
      );
      user = { id, email, phone: null, subscription_tier: 'free' };
    }

    const { token, subscriptionTier } = issueTokenForUser(user);
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
