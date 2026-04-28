import { Router } from 'express';
import { asyncRoute } from '../async-route.js';
import { queryAll, queryOne, runExec } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

export const userRouter = Router();

/**
 * GET /api/user/export
 * Returns a complete JSON export of everything the authenticated user owns.
 * Suitable for GDPR / DPDP data-portability requests.
 */
userRouter.get(
  '/export',
  authMiddleware,
  asyncRoute(async (req, res) => {
    const userId = req.userId!;

    // Account
    const account = await queryOne<{
      id: string;
      email: string;
      phone: string | null;
      subscription_tier: string | null;
      created_at: string;
    }>('SELECT id, email, phone, subscription_tier, created_at FROM users WHERE id = ?', [userId]);

    if (!account) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Profiles
    const profiles = await queryAll<{
      id: string;
      name: string;
      patient_group: string;
      created_at: string;
    }>('SELECT id, name, patient_group, created_at FROM profiles WHERE user_id = ? ORDER BY created_at', [userId]);

    // Medications + dose logs per profile
    const profilesWithData = await Promise.all(
      profiles.map(async (p) => {
        const medications = await queryAll<{
          id: string;
          name: string;
          dosage_note: string | null;
          times_json: string;
          enabled: number;
          kind: string | null;
          created_at: string | null;
        }>(
          'SELECT id, name, dosage_note, times_json, enabled, kind, NULL AS created_at FROM medications WHERE profile_id = ? ORDER BY name',
          [p.id]
        );

        const medsWithLogs = await Promise.all(
          medications.map(async (m) => {
            const logs = await queryAll<{
              date: string;
              scheduled_time: string;
              status: string;
              logged_at: string;
            }>(
              'SELECT date, scheduled_time, status, logged_at FROM dose_logs WHERE medication_id = ? ORDER BY date DESC, scheduled_time',
              [m.id]
            );
            return {
              id: m.id,
              name: m.name,
              dosageNote: m.dosage_note,
              times: JSON.parse(m.times_json ?? '[]') as string[],
              enabled: Boolean(m.enabled),
              kind: m.kind,
              doseLogs: logs,
            };
          })
        );

        return { id: p.id, name: p.name, patientGroup: p.patient_group, createdAt: p.created_at, medications: medsWithLogs };
      })
    );

    // Caretaker links — profiles this user caretakes
    const caretaking = await queryAll<{ profile_id: string; profile_name: string; linked_at: string }>(
      `SELECT cl.profile_id, p.name AS profile_name, cl.created_at AS linked_at
       FROM caretaker_links cl
       INNER JOIN profiles p ON p.id = cl.profile_id
       WHERE cl.caretaker_user_id = ?`,
      [userId]
    );

    // Caretaker links — people caretaking this user's profiles
    const caretakerLinks = await queryAll<{
      profile_id: string;
      profile_name: string;
      caretaker_email: string;
      linked_at: string;
    }>(
      `SELECT cl.profile_id, p.name AS profile_name, u.email AS caretaker_email, cl.created_at AS linked_at
       FROM caretaker_links cl
       INNER JOIN profiles p ON p.id = cl.profile_id
       INNER JOIN users u ON u.id = cl.caretaker_user_id
       WHERE p.user_id = ?`,
      [userId]
    );

    res.json({
      exportedAt: new Date().toISOString(),
      account: {
        id: account.id,
        email: account.email,
        phone: account.phone,
        subscriptionTier: account.subscription_tier ?? 'free',
        createdAt: account.created_at,
      },
      profiles: profilesWithData,
      caretaking,
      caretakerLinks,
    });
  })
);

/**
 * DELETE /api/user/account
 * Permanently deletes the user account and ALL associated data (profiles, medications,
 * dose logs, caretaker links, invites, alerts) via ON DELETE CASCADE.
 */
userRouter.delete(
  '/account',
  authMiddleware,
  asyncRoute(async (req, res) => {
    const userId = req.userId!;

    const user = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // CASCADE deletes profiles → medications → dose_logs, caretaker_* tables, etc.
    await runExec('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ ok: true, message: 'Account and all associated data permanently deleted.' });
  })
);
