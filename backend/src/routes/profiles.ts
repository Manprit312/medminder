import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { asyncRoute } from '../async-route.js';
import { isPostgres, queryAll, queryOne, runExec } from '../db.js';
import { mapMedicationRow, type MedicationRow } from '../medication-map.js';
import { authMiddleware } from '../middleware/auth.js';

export const profilesRouter = Router();

profilesRouter.use(authMiddleware);

function orderByName(): string {
  return isPostgres() ? 'ORDER BY LOWER(name)' : 'ORDER BY name COLLATE NOCASE';
}

function mapProfileRow(row: {
  id: string;
  name: string;
  created_at: string;
  caregiver_email: string | null;
  caregiver_phone: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    caregiverEmail: row.caregiver_email ?? undefined,
    caregiverPhone: row.caregiver_phone ?? undefined,
  };
}

profilesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const rows = await queryAll<{
      id: string;
      name: string;
      created_at: string;
      caregiver_email: string | null;
      caregiver_phone: string | null;
    }>(
      `SELECT id, name, created_at, caregiver_email, caregiver_phone FROM profiles WHERE user_id = ? ${orderByName()}`,
      [userId]
    );
    res.json({ profiles: rows.map(mapProfileRow) });
  })
);

function caregiverField(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

profilesRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const caregiverEmail = caregiverField(req.body?.caregiverEmail);
    const caregiverPhone = caregiverField(req.body?.caregiverPhone);
    const id = uuid();
    const now = new Date().toISOString();
    await runExec(
      'INSERT INTO profiles (id, user_id, name, created_at, caregiver_email, caregiver_phone) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, name, now, caregiverEmail, caregiverPhone]
    );
    const row = await queryOne<{
      id: string;
      name: string;
      created_at: string;
      caregiver_email: string | null;
      caregiver_phone: string | null;
    }>('SELECT id, name, created_at, caregiver_email, caregiver_phone FROM profiles WHERE id = ?', [id]);
    if (!row) {
      res.status(500).json({ error: 'Failed to create profile' });
      return;
    }
    res.status(201).json({ profile: mapProfileRow(row) });
  })
);

/** List medications for a profile — must be registered before GET /:id */
profilesRouter.get(
  '/:id/medications',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const profileId = req.params.id;
    const p = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = ? AND user_id = ?',
      [profileId, userId]
    );
    if (!p) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const rows = await queryAll<MedicationRow>(
      `SELECT id, profile_id, name, dosage_note, times_json, enabled, remaining_quantity, pills_per_intake FROM medications WHERE profile_id = ? ${orderByName()}`,
      [profileId]
    );
    res.json({ medications: rows.map(mapMedicationRow) });
  })
);

profilesRouter.post(
  '/:id/medications',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const profileId = req.params.id;
    const p = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = ? AND user_id = ?',
      [profileId, userId]
    );
    if (!p) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const name = String(req.body?.name ?? '').trim();
    const times = req.body?.times as unknown;
    if (!name || !Array.isArray(times) || times.length === 0) {
      res.status(400).json({ error: 'name and non-empty times array required' });
      return;
    }
    const timeStrs = times.map((t) => String(t).trim()).filter(Boolean);
    if (timeStrs.length === 0) {
      res.status(400).json({ error: 'times must contain at least one value' });
      return;
    }
    const dosageNote = req.body?.dosageNote != null ? String(req.body.dosageNote).trim() : '';
    const enabled = req.body?.enabled !== false;
    const rq = req.body?.remainingQuantity;
    const remainingQuantity =
      rq === undefined || rq === null || rq === ''
        ? null
        : Math.max(0, Math.floor(Number(rq)) || 0);
    const pillsPerIntake = Math.max(1, Math.floor(Number(req.body?.pillsPerIntake ?? 1)) || 1);
    const id = uuid();
    await runExec(
      'INSERT INTO medications (id, profile_id, name, dosage_note, times_json, enabled, remaining_quantity, pills_per_intake) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        profileId,
        name,
        dosageNote || null,
        JSON.stringify(timeStrs),
        enabled ? 1 : 0,
        remainingQuantity,
        pillsPerIntake,
      ]
    );
    const row = await queryOne<MedicationRow>(
      'SELECT id, profile_id, name, dosage_note, times_json, enabled, remaining_quantity, pills_per_intake FROM medications WHERE id = ?',
      [id]
    );
    if (!row) {
      res.status(500).json({ error: 'Failed to create medication' });
      return;
    }
    res.status(201).json({ medication: mapMedicationRow(row) });
  })
);

profilesRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const row = await queryOne<{
      id: string;
      name: string;
      created_at: string;
      caregiver_email: string | null;
      caregiver_phone: string | null;
    }>(
      'SELECT id, name, created_at, caregiver_email, caregiver_phone FROM profiles WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (!row) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ profile: mapProfileRow(row) });
  })
);

profilesRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const caregiverEmail = caregiverField(req.body?.caregiverEmail);
    const caregiverPhone = caregiverField(req.body?.caregiverPhone);
    const r = await runExec(
      'UPDATE profiles SET name = ?, caregiver_email = ?, caregiver_phone = ? WHERE id = ? AND user_id = ?',
      [name, caregiverEmail, caregiverPhone, req.params.id, userId]
    );
    if (r.changes === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const row = await queryOne<{
      id: string;
      name: string;
      created_at: string;
      caregiver_email: string | null;
      caregiver_phone: string | null;
    }>('SELECT id, name, created_at, caregiver_email, caregiver_phone FROM profiles WHERE id = ?', [
      req.params.id,
    ]);
    if (!row) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ profile: mapProfileRow(row) });
  })
);

profilesRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const r = await runExec('DELETE FROM profiles WHERE id = ? AND user_id = ?', [
      req.params.id,
      userId,
    ]);
    if (r.changes === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.status(204).send();
  })
);
