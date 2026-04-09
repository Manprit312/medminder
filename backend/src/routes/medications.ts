import { Router } from 'express';
import { asyncRoute } from '../async-route.js';
import { queryOne, runExec } from '../db.js';
import { mapMedicationRow, parseMedicationKind, type MedicationRow } from '../medication-map.js';
import { authMiddleware } from '../middleware/auth.js';

export const medicationsRouter = Router();

medicationsRouter.use(authMiddleware);

async function medicationOwnedByUser(medicationId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT m.id FROM medications m
     INNER JOIN profiles p ON p.id = m.profile_id
     WHERE m.id = ? AND p.user_id = ?`,
    [medicationId, userId]
  );
  return Boolean(row);
}

medicationsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const row = await queryOne<MedicationRow>(
      `SELECT m.id, m.profile_id, m.name, m.dosage_note, m.times_json, m.enabled, m.remaining_quantity, m.pills_per_intake, m.kind
       FROM medications m
       INNER JOIN profiles p ON p.id = m.profile_id
       WHERE m.id = ? AND p.user_id = ?`,
      [req.params.id, userId]
    );
    if (!row) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    res.json({ medication: mapMedicationRow(row) });
  })
);

medicationsRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const id = req.params.id;
    if (!(await medicationOwnedByUser(id, userId))) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    const existing = await queryOne<MedicationRow>(
      'SELECT id, profile_id, name, dosage_note, times_json, enabled, remaining_quantity, pills_per_intake, kind FROM medications WHERE id = ?',
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    const name = req.body?.name != null ? String(req.body.name).trim() : existing.name;
    const dosageNote =
      req.body?.dosageNote !== undefined
        ? String(req.body.dosageNote).trim() || null
        : existing.dosage_note;
    let timesJson = existing.times_json;
    if (req.body?.times != null) {
      const times = req.body.times as unknown;
      if (!Array.isArray(times) || times.length === 0) {
        res.status(400).json({ error: 'times must be a non-empty array' });
        return;
      }
      timesJson = JSON.stringify(times.map((t) => String(t).trim()).filter(Boolean));
    }
    const enabled =
      req.body?.enabled !== undefined ? (req.body.enabled ? 1 : 0) : existing.enabled;

    let remainingQuantity = existing.remaining_quantity;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'remainingQuantity')) {
      const rq = req.body?.remainingQuantity;
      remainingQuantity =
        rq === undefined || rq === null || rq === ''
          ? null
          : Math.max(0, Math.floor(Number(rq)) || 0);
    }

    let pillsPerIntake = existing.pills_per_intake ?? 1;
    if (req.body?.pillsPerIntake !== undefined) {
      pillsPerIntake = Math.max(1, Math.floor(Number(req.body.pillsPerIntake)) || 1);
    }

    let kind: string | null = existing.kind;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'kind')) {
      const v = req.body?.kind;
      if (v === null || v === '') {
        kind = null;
      } else {
        const parsed = parseMedicationKind(v);
        kind = parsed ?? null;
      }
    }

    await runExec(
      'UPDATE medications SET name = ?, dosage_note = ?, times_json = ?, enabled = ?, remaining_quantity = ?, pills_per_intake = ?, kind = ? WHERE id = ?',
      [name, dosageNote, timesJson, enabled, remainingQuantity, pillsPerIntake, kind, id]
    );

    const row = await queryOne<MedicationRow>(
      'SELECT id, profile_id, name, dosage_note, times_json, enabled, remaining_quantity, pills_per_intake, kind FROM medications WHERE id = ?',
      [id]
    );
    if (!row) {
      res.status(500).json({ error: 'Medication update failed' });
      return;
    }
    res.json({ medication: mapMedicationRow(row) });
  })
);

medicationsRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = req.userId!;
    const id = req.params.id;
    if (!(await medicationOwnedByUser(id, userId))) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    await runExec('DELETE FROM medications WHERE id = ?', [id]);
    res.status(204).send();
  })
);
