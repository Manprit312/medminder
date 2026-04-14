import { Router } from 'express';
import { asyncRoute } from '../async-route.js';
import { notifyCaretakersDoseEvent } from '../caretaker-dose-notify.js';
import { isPostgres, queryOne, queryAll, runExec } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

export const doseLogsRouter = Router();

doseLogsRouter.use(authMiddleware);

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function medOwnedByUser(medicationId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT m.id FROM medications m
     INNER JOIN profiles p ON p.id = m.profile_id
     WHERE m.id = ? AND p.user_id = ?`,
    [medicationId, userId]
  );
  return Boolean(row);
}

function mapLogRows(
  rows: {
    id: string;
    medication_id: string;
    date: string;
    scheduled_time: string;
    status: string;
    logged_at: string;
  }[]
) {
  return rows.map((r) => ({
    id: r.id,
    medicationId: r.medication_id,
    date: r.date,
    scheduledTime: r.scheduled_time,
    status: r.status,
    loggedAt: r.logged_at,
  }));
}

function upsertDoseLogSql(): string {
  if (isPostgres()) {
    return `INSERT INTO dose_logs (id, medication_id, date, scheduled_time, status, logged_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (medication_id, date, scheduled_time) DO UPDATE SET
       status = EXCLUDED.status,
       logged_at = EXCLUDED.logged_at`;
  }
  return `INSERT INTO dose_logs (id, medication_id, date, scheduled_time, status, logged_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(medication_id, date, scheduled_time) DO UPDATE SET
       status = excluded.status,
       logged_at = excluded.logged_at`;
}

/** GET /dose-logs?date=YYYY-MM-DD | GET /dose-logs?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive) */
doseLogsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const from = String(req.query.from ?? '').trim();
    const to = String(req.query.to ?? '').trim();
    const date = String(req.query.date ?? '').trim();

    if (from && to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        res.status(400).json({ error: 'Query from and to must be YYYY-MM-DD' });
        return;
      }
      if (from > to) {
        res.status(400).json({ error: 'from must be <= to' });
        return;
      }
      const rows = await queryAll<{
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
         INNER JOIN profiles p ON p.id = m.profile_id
         WHERE p.user_id = ? AND d.date >= ? AND d.date <= ?
         ORDER BY d.date, d.scheduled_time`,
        [userId, from, to]
      );
      res.json({ from, to, logs: mapLogRows(rows) });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Query ?date=YYYY-MM-DD or ?from=&to= is required' });
      return;
    }
    const rows = await queryAll<{
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
       INNER JOIN profiles p ON p.id = m.profile_id
       WHERE p.user_id = ? AND d.date = ?
       ORDER BY d.scheduled_time`,
      [userId, date]
    );
    res.json({
      date,
      logs: mapLogRows(rows),
    });
  })
);

/** POST { medicationId, date, scheduledTime, status } */
doseLogsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const medicationId = String(req.body?.medicationId ?? '').trim();
    const date = String(req.body?.date ?? '').trim();
    const scheduledTime = String(req.body?.scheduledTime ?? '').trim();
    const status = String(req.body?.status ?? '').trim() as 'taken' | 'skipped' | 'missed';
    if (
      !medicationId ||
      !date ||
      !scheduledTime ||
      (status !== 'taken' && status !== 'skipped' && status !== 'missed')
    ) {
      res.status(400).json({ error: 'medicationId, date, scheduledTime, status (taken|skipped|missed) required' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }
    if (!(await medOwnedByUser(medicationId, userId))) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    const id = `${medicationId}|${date}|${scheduledTime}`;
    const loggedAt = new Date().toISOString();

    const prevRow = await queryOne<{ status: string }>(
      'SELECT status FROM dose_logs WHERE medication_id = ? AND date = ? AND scheduled_time = ?',
      [medicationId, date, scheduledTime]
    );
    const prevStatus = prevRow?.status;

    await runExec(upsertDoseLogSql(), [id, medicationId, date, scheduledTime, status, loggedAt]);

    const medStock = await queryOne<{ remaining_quantity: number | null; pills_per_intake: number }>(
      'SELECT remaining_quantity, pills_per_intake FROM medications WHERE id = ?',
      [medicationId]
    );
    if (medStock && medStock.remaining_quantity != null) {
      const p = medStock.pills_per_intake > 0 ? medStock.pills_per_intake : 1;
      let delta = 0;
      if (prevStatus === 'taken' && status !== 'taken') {
        delta += p;
      }
      if (prevStatus !== 'taken' && status === 'taken') {
        delta -= p;
      }
      if (delta !== 0) {
        const next = Math.max(0, medStock.remaining_quantity + delta);
        await runExec('UPDATE medications SET remaining_quantity = ? WHERE id = ?', [next, medicationId]);
      }
    }

    const row = await queryOne<{
      id: string;
      medication_id: string;
      date: string;
      scheduled_time: string;
      status: string;
      logged_at: string;
    }>('SELECT id, medication_id, date, scheduled_time, status, logged_at FROM dose_logs WHERE id = ?', [id]);
    if (!row) {
      res.status(500).json({ error: 'Failed to save dose log' });
      return;
    }

    if (status === 'missed' && date === todayStr()) {
      const meta = await queryOne<{ name: string; profile_id: string; profile_name: string }>(
        `SELECT m.name, p.id AS profile_id, p.name AS profile_name
         FROM medications m INNER JOIN profiles p ON p.id = m.profile_id WHERE m.id = ?`,
        [medicationId]
      );
      if (meta) {
        setImmediate(() => {
          void notifyCaretakersDoseEvent({
            medicationId,
            medicationName: meta.name,
            profileName: meta.profile_name,
            status,
            date,
            scheduledTime,
            profileId: meta.profile_id,
          }).catch((err) => console.error('[dose-logs] caretaker notify', err));
        });
      }
    }

    res.status(201).json({
      log: {
        id: row.id,
        medicationId: row.medication_id,
        date: row.date,
        scheduledTime: row.scheduled_time,
        status: row.status,
        loggedAt: row.logged_at,
      },
    });
  })
);
