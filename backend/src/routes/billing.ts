import crypto from 'crypto';
import { Router } from 'express';
import Razorpay from 'razorpay';
import { asyncRoute } from '../async-route.js';
import { queryOne, runExec } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

export const billingRouter = Router();

billingRouter.use(authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRazorpayInstance(): Razorpay {
  const keyId = process.env['RAZORPAY_KEY_ID']?.trim();
  const keySecret = process.env['RAZORPAY_KEY_SECRET']?.trim();
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/** Price in paise (1 INR = 100 paise). Default: ₹999 */
function lifetimePricePaise(): number {
  const raw = process.env['RAZORPAY_LIFETIME_PRICE_PAISE'];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 99900;
}

function allowBillingSimulation(): boolean {
  return (
    process.env['DEV_BILLING_SIMULATION'] === 'true' ||
    process.env['MEDMINDER_ALLOW_BILLING_SIMULATION'] === 'true' ||
    process.env['NODE_ENV'] === 'development' ||
    process.env['NODE_ENV'] === 'test'
  );
}

// ---------------------------------------------------------------------------
// POST /api/billing/razorpay/create-order
// Creates a Razorpay order for the lifetime Plus purchase.
// ---------------------------------------------------------------------------
billingRouter.post(
  '/razorpay/create-order',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;

    // Idempotency: if already premium, nothing to buy.
    const user = await queryOne<{ subscription_tier: string }>(
      'SELECT subscription_tier FROM users WHERE id = ?',
      [userId]
    );
    if (user?.subscription_tier === 'premium') {
      res.status(409).json({ error: 'already_premium', message: 'You already have MedMinder Plus.' });
      return;
    }

    let rz: Razorpay;
    try {
      rz = getRazorpayInstance();
    } catch {
      res.status(503).json({
        error: 'payment_not_configured',
        message: 'Payment is not configured on this server. Contact support.',
      });
      return;
    }

    const amount = lifetimePricePaise();
    const order = (await rz.orders.create({
      amount,
      currency: 'INR',
      receipt: `lifetime_${userId.slice(0, 16)}`,
    })) as { id: string; amount: number; currency: string };

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env['RAZORPAY_KEY_ID']!.trim(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/billing/razorpay/verify
// Verifies Razorpay payment signature and upgrades user to premium.
// ---------------------------------------------------------------------------
billingRouter.post(
  '/razorpay/verify',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body as {
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      res.status(400).json({ error: 'missing_fields', message: 'Payment fields are incomplete.' });
      return;
    }

    const keySecret = process.env['RAZORPAY_KEY_SECRET']?.trim();
    if (!keySecret) {
      res.status(503).json({
        error: 'payment_not_configured',
        message: 'Payment verification is not configured on this server.',
      });
      return;
    }

    // HMAC-SHA256 verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ error: 'invalid_signature', message: 'Payment signature verification failed.' });
      return;
    }

    // Upgrade user to premium (lifetime)
    await runExec("UPDATE users SET subscription_tier = 'premium' WHERE id = ?", [userId]);

    res.json({ ok: true, subscriptionTier: 'premium' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/billing/simulate-tier  (dev / staging only)
// ---------------------------------------------------------------------------
billingRouter.post(
  '/simulate-tier',
  asyncRoute(async (req, res) => {
    if (!allowBillingSimulation()) {
      res.status(403).json({
        error: 'Simulated billing is disabled in production. Integrate Razorpay for real purchases.',
      });
      return;
    }
    const tier = String(req.body?.tier ?? '').trim().toLowerCase();
    if (tier !== 'free' && tier !== 'premium') {
      res.status(400).json({ error: 'tier must be free or premium' });
      return;
    }
    const userId = req.userId!;
    await runExec('UPDATE users SET subscription_tier = ? WHERE id = ?', [tier, userId]);
    res.json({ ok: true, subscriptionTier: tier === 'premium' ? 'premium' : 'free' });
  })
);
