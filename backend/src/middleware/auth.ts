import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db.js';

export interface AuthPayload {
  sub: string;
  email: string;
  phone?: string;
}

/**
 * Verifies JWT and ensures `users` row exists (avoids SQLite FOREIGN KEY errors when the DB
 * was reset but clients still hold an old token — e.g. Render ephemeral disk).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    res.status(500).json({ error: 'Server misconfigured: JWT_SECRET' });
    return;
  }
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice(7);

  void (async () => {
    try {
      const decoded = jwt.verify(token, secret) as AuthPayload;
      const row = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ?', [decoded.sub]);
      if (!row) {
        res.status(401).json({
          error: 'Account not found. Sign out and sign in with Google again.',
        });
        return;
      }
      req.userId = decoded.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  })();
}
