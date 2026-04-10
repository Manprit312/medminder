import { Router } from 'express';
import { asyncRoute } from '../async-route.js';
import { runExec } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Development / simulation only. Real App Store / Play subscriptions should update `subscription_tier`
 * via webhooks (e.g. RevenueCat) in production.
 */
export const billingRouter = Router();

billingRouter.use(authMiddleware);

function allowBillingSimulation(): boolean {
  return (
    process.env.DEV_BILLING_SIMULATION === 'true' ||
    process.env.MEDMINDER_ALLOW_BILLING_SIMULATION === 'true' ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  );
}

billingRouter.post(
  '/simulate-tier',
  asyncRoute(async (req, res) => {
    if (!allowBillingSimulation()) {
      res.status(403).json({
        error:
          'Simulated billing is disabled in production. Set DEV_BILLING_SIMULATION=true for staging, or integrate store webhooks.',
      });
      return;
    }
    const tier = String(req.body?.tier ?? '').trim().toLowerCase();
    if (tier !== 'free' && tier !== 'premium') {
      res.status(400).json({ error: 'tier must be free or premium' });
      return;
    }
    const userId = req.userId!;
    const dbTier = tier === 'premium' ? 'premium' : 'free';
    await runExec('UPDATE users SET subscription_tier = ? WHERE id = ?', [dbTier, userId]);
    res.json({ ok: true, subscriptionTier: dbTier === 'premium' ? 'premium' : 'free' });
  })
);
