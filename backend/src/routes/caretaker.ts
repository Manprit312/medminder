import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { asyncRoute } from '../async-route.js';
import { queryAll, queryOne, runExec } from '../db.js';
import { mapMedicationRow, type MedicationRow } from '../medication-map.js';
import { authMiddleware } from '../middleware/auth.js';
import { isSmtpConfigured, publicAppUrl, sendCaretakerInviteEmail } from '../email.js';

export const caretakerRouter = Router();

const INVITE_VALID_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function inviterIsPremium(userId: string): Promise<boolean> {
  const row = await queryOne<{ subscription_tier: string | null }>(
    'SELECT subscription_tier FROM users WHERE id = ?',
    [userId]
  );
  return row?.subscription_tier === 'premium';
}

async function profileOwnedByUser(profileId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    'SELECT id FROM profiles WHERE id = ? AND user_id = ?',
    [profileId, userId]
  );
  return Boolean(row);
}

/** POST { profileId, inviteeEmail } — inviter must own profile + MedMinder Plus */
caretakerRouter.post(
  '/invites',
  authMiddleware,
  asyncRoute(async (req, res) => {
    const inviterId = req.userId!;
    if (!(await inviterIsPremium(inviterId))) {
      res.status(403).json({ error: 'Caretaker invites require MedMinder Plus' });
      return;
    }
    const profileId = String(req.body?.profileId ?? '').trim();
    const inviteeEmail = String(req.body?.inviteeEmail ?? '')
      .trim()
      .toLowerCase();
    if (!profileId || !inviteeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
      res.status(400).json({ error: 'profileId and valid inviteeEmail required' });
      return;
    }
    if (!(await profileOwnedByUser(profileId, inviterId))) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const inviter = await queryOne<{ email: string }>('SELECT email FROM users WHERE id = ?', [inviterId]);
    if (inviteeEmail === inviter?.email?.trim().toLowerCase()) {
      res.status(400).json({ error: 'Invite a different person than yourself' });
      return;
    }

    const existingUser = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [
      inviteeEmail,
    ]);
    if (existingUser) {
      const already = await queryOne<{ x: number }>(
        'SELECT 1 AS x FROM caretaker_links WHERE profile_id = ? AND caretaker_user_id = ?',
        [profileId, existingUser.id]
      );
      if (already) {
        res.status(409).json({ error: 'This person is already a caretaker for this profile' });
        return;
      }
    }

    const plainToken = randomBytes(24).toString('hex');
    const tokenHash = hashToken(plainToken);
    const id = uuid();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_VALID_MS).toISOString();
    await runExec(
      `INSERT INTO caretaker_invites (id, profile_id, inviter_user_id, invitee_email, token_hash, expires_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, profileId, inviterId, inviteeEmail, tokenHash, expiresAt, now]
    );

    const prof = await queryOne<{ name: string }>('SELECT name FROM profiles WHERE id = ?', [profileId]);
    const acceptUrl = `${publicAppUrl()}/accept-caretaker-invite?token=${encodeURIComponent(plainToken)}`;

    let emailed = false;
    let mailHint: string | undefined;

    function safeErr(e: unknown): string {
      const m = e instanceof Error ? e.message : String(e);
      return m.length > 200 ? `${m.slice(0, 197)}…` : m;
    }

    if (isSmtpConfigured()) {
      try {
        await sendCaretakerInviteEmail(inviteeEmail, {
          inviterHint: inviter?.email ?? 'Someone',
          profileName: prof?.name ?? 'Family member',
          acceptUrl,
        });
        emailed = true;
      } catch (e) {
        console.error('[caretaker] invite email failed', e);
        mailHint = `Send failed: ${safeErr(e)}`;
      }
    } else {
      mailHint =
        'Email not configured on API: set RESEND_API_KEY (Resend) or SMTP_HOST/SMTP_USER/SMTP_PASS, plus EMAIL_FROM and APP_PUBLIC_URL. Redeploy after saving env.';
      console.warn('[caretaker] SMTP not configured — share this invite link manually:');
      console.warn(acceptUrl);
    }

    res.status(201).json({
      invite: { id, expiresAt, emailed },
      /** Only returned once — for manual sharing when SMTP is off or send failed */
      acceptUrl: emailed ? undefined : acceptUrl,
      mailHint: emailed ? undefined : mailHint,
    });
  })
);

/** Public: GET ?token= — preview invite (no auth) */
caretakerRouter.get(
  '/invites/preview',
  asyncRoute(async (req, res) => {
    const token = String(req.query.token ?? '').trim();
    if (!token) {
      res.status(400).json({ error: 'token query required' });
      return;
    }
    const tokenHash = hashToken(token);
    const row = await queryOne<{
      invitee_email: string;
      expires_at: string;
      status: string;
      profile_name: string;
    }>(
      `SELECT i.invitee_email, i.expires_at, i.status, p.name AS profile_name
       FROM caretaker_invites i
       INNER JOIN profiles p ON p.id = i.profile_id
       WHERE i.token_hash = ?`,
      [tokenHash]
    );
    if (!row || row.status !== 'pending') {
      res.status(404).json({ error: 'Invite not found or already used' });
      return;
    }
    if (new Date(row.expires_at) <= new Date()) {
      res.status(410).json({ error: 'Invite expired' });
      return;
    }
    res.json({
      inviteeEmail: row.invitee_email,
      profileName: row.profile_name,
    });
  })
);

/** POST { token } — authenticated user must match invitee email */
caretakerRouter.post(
  '/invites/accept',
  authMiddleware,
  asyncRoute(async (req, res) => {
    const token = String(req.body?.token ?? '').trim();
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    const caretakerId = req.userId!;
    const caretaker = await queryOne<{ email: string }>('SELECT email FROM users WHERE id = ?', [
      caretakerId,
    ]);
    if (!caretaker) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const caretakerEmail = caretaker.email.trim().toLowerCase();
    const tokenHash = hashToken(token);
    const inv = await queryOne<{
      id: string;
      profile_id: string;
      invitee_email: string;
      expires_at: string;
      status: string;
    }>('SELECT id, profile_id, invitee_email, expires_at, status FROM caretaker_invites WHERE token_hash = ?', [
      tokenHash,
    ]);
    if (!inv || inv.status !== 'pending') {
      res.status(404).json({ error: 'Invite not found or already used' });
      return;
    }
    if (new Date(inv.expires_at) <= new Date()) {
      res.status(410).json({ error: 'Invite expired' });
      return;
    }
    if (inv.invitee_email.trim().toLowerCase() !== caretakerEmail) {
      res.status(403).json({ error: 'Sign in with the invited email address to accept' });
      return;
    }

    const now = new Date().toISOString();
    await runExec(
      'INSERT INTO caretaker_links (profile_id, caretaker_user_id, created_at) VALUES (?, ?, ?)',
      [inv.profile_id, caretakerId, now]
    );
    await runExec("UPDATE caretaker_invites SET status = 'accepted' WHERE id = ?", [inv.id]);

    res.json({ ok: true, profileId: inv.profile_id });
  })
);

/** List profiles the current user caretakes */
caretakerRouter.get(
  '/caretaking',
  authMiddleware,
  asyncRoute(async (req, res) => {
    const uid = req.userId!;
    const rows = await queryAll<{ id: string; name: string }>(
      `SELECT p.id, p.name FROM caretaker_links cl
       INNER JOIN profiles p ON p.id = cl.profile_id
       WHERE cl.caretaker_user_id = ?
       ORDER BY LOWER(p.name)`,
      [uid]
    );
    res.json({ profiles: rows });
  })
);

/** GET detail: medications + dose logs for a date (caretaker read-only) */
caretakerRouter.get(
  '/caretaking/:profileId',
  authMiddleware,
  asyncRoute(async (req, res) => {
    const uid = req.userId!;
    const profileId = req.params.profileId;
    const link = await queryOne<{ x: number }>(
      'SELECT 1 AS x FROM caretaker_links WHERE profile_id = ? AND caretaker_user_id = ?',
      [profileId, uid]
    );
    if (!link) {
      res.status(404).json({ error: 'Not a caretaker for this profile' });
      return;
    }
    const profile = await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM profiles WHERE id = ?',
      [profileId]
    );
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const date = String(req.query.date ?? '').trim();
    const logDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);

    const medRows = await queryAll<MedicationRow>(
      `SELECT m.id, m.profile_id, m.name, m.dosage_note, m.times_json, m.enabled, m.remaining_quantity, m.pills_per_intake, m.kind
       FROM medications m WHERE m.profile_id = ? ORDER BY LOWER(m.name)`,
      [profileId]
    );
    const medications = medRows.map(mapMedicationRow);

    const logRows = await queryAll<{
      id: string;
      medication_id: string;
      date: string;
      scheduled_time: string;
      status: string;
      logged_at: string;
    }>(
      `SELECT d.id, d.medication_id, d.date, d.scheduled_time, d.status, d.logged_at
       FROM dose_logs d
       INNER JOIN medications m ON m.id = d.medication_id
       WHERE m.profile_id = ? AND d.date = ?
       ORDER BY d.scheduled_time`,
      [profileId, logDate]
    );
    const logs = logRows.map((r) => ({
      id: r.id,
      medicationId: r.medication_id,
      date: r.date,
      scheduledTime: r.scheduled_time,
      status: r.status,
      loggedAt: r.logged_at,
    }));

    res.json({
      profile: { id: profile.id, name: profile.name },
      date: logDate,
      medications,
      logs,
    });
  })
);
