import { queryAll, queryOne } from './db.js';
import { runExec } from './db.js';
import { isSmtpConfigured, sendCaretakerDoseAlertEmail, sendCaretakerWeeklyDigestEmail } from './email.js';

/**
 * After a dose is logged skipped/missed, email profile caretaker contacts + linked in-app caretakers (SMTP only).
 */
export async function notifyCaretakersDoseEvent(payload: {
  medicationId: string;
  medicationName: string;
  profileName: string;
  status: string;
  date: string;
  scheduledTime: string;
  profileId: string;
}): Promise<void> {
  if (payload.status !== 'missed') {
    return;
  }

  const row = await queryOne<{
    caregiver_email: string | null;
    caregiver_phone: string | null;
  }>(
    'SELECT caregiver_email, caregiver_phone FROM profiles WHERE id = ?',
    [payload.profileId]
  );
  const emails = new Set<string>();
  if (row?.caregiver_email?.trim()) {
    emails.add(row.caregiver_email.trim().toLowerCase());
  }

  const linked = await queryAll<{ caretaker_user_id: string; email: string }>(
    `SELECT cl.caretaker_user_id, u.email FROM caretaker_links cl
     INNER JOIN users u ON u.id = cl.caretaker_user_id
     WHERE cl.profile_id = ?`,
    [payload.profileId]
  );
  const linkedUserIds = new Set<string>();
  for (const l of linked) {
    if (l.caretaker_user_id) {
      linkedUserIds.add(l.caretaker_user_id);
    }
    if (l.email?.trim()) {
      emails.add(l.email.trim().toLowerCase());
    }
  }

  const message = `${payload.profileName} missed ${payload.medicationName} at ${payload.scheduledTime} on ${payload.date}.`;
  for (const caretakerUserId of linkedUserIds) {
    const id = `${caretakerUserId}|${payload.medicationId}|${payload.date}|${payload.scheduledTime}|missed`;
    const exists = await queryOne<{ id: string }>('SELECT id FROM caretaker_alerts WHERE id = ?', [id]);
    if (exists) {
      continue;
    }
    await runExec(
      `INSERT INTO caretaker_alerts
        (id, caretaker_user_id, profile_id, medication_id, profile_name, medication_name, date, scheduled_time, status, message, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        caretakerUserId,
        payload.profileId,
        payload.medicationId,
        payload.profileName,
        payload.medicationName,
        payload.date,
        payload.scheduledTime,
        'missed',
        message,
        new Date().toISOString(),
      ]
    );
  }

  if (!isSmtpConfigured()) {
    return;
  }
  for (const to of emails) {
    try {
      await sendCaretakerDoseAlertEmail(to, {
        profileName: payload.profileName,
        medicationName: payload.medicationName,
        date: payload.date,
        scheduledTime: payload.scheduledTime,
        statusLabel: 'missed',
      });
    } catch (e) {
      console.error('[caretaker-dose-notify] send failed', to, e);
    }
  }

  await maybeTriggerEscalation(payload.profileId, payload.profileName, emails, linkedUserIds);
}

async function maybeTriggerEscalation(
  profileId: string,
  profileName: string,
  emails: Set<string>,
  linkedUserIds: Set<string>
): Promise<void> {
  const rule = await queryOne<{
    enabled: number;
    window_days: number;
    missed_threshold: number;
    last_trigger_date: string | null;
  }>(
    `SELECT enabled, window_days, missed_threshold, last_trigger_date
     FROM caretaker_escalation_rules
     WHERE profile_id = ?`,
    [profileId]
  );
  if (!rule || !rule.enabled) {
    return;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (rule.last_trigger_date === today) {
    return;
  }
  const windowDays = Math.max(1, Math.min(30, Math.floor(rule.window_days || 3)));
  const threshold = Math.max(1, Math.min(20, Math.floor(rule.missed_threshold || 2)));
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - (windowDays - 1));
  const from = fromDate.toISOString().slice(0, 10);

  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(1) AS c
     FROM dose_logs d
     INNER JOIN medications m ON m.id = d.medication_id
     WHERE m.profile_id = ? AND d.status = 'missed' AND d.date >= ? AND d.date <= ?`,
    [profileId, from, today]
  );
  const missedCount = Number(row?.c ?? 0);
  if (missedCount < threshold) {
    return;
  }

  const message = `${profileName} missed ${missedCount} doses in the last ${windowDays} day(s). Please check in.`;
  for (const caretakerUserId of linkedUserIds) {
    const id = `${caretakerUserId}|${profileId}|${today}|escalation`;
    const exists = await queryOne<{ id: string }>('SELECT id FROM caretaker_alerts WHERE id = ?', [id]);
    if (exists) {
      continue;
    }
    await runExec(
      `INSERT INTO caretaker_alerts
        (id, caretaker_user_id, profile_id, medication_id, profile_name, medication_name, date, scheduled_time, status, message, created_at, read_at)
       VALUES (?, ?, ?, '', ?, '', ?, '', 'escalation', ?, ?, NULL)`,
      [id, caretakerUserId, profileId, profileName, today, message, new Date().toISOString()]
    );
  }

  await runExec('UPDATE caretaker_escalation_rules SET last_trigger_date = ?, updated_at = ? WHERE profile_id = ?', [
    today,
    new Date().toISOString(),
    profileId,
  ]);

  if (!isSmtpConfigured()) {
    return;
  }
  for (const to of emails) {
    try {
      await sendCaretakerWeeklyDigestEmail(to, {
        profileName,
        dateFrom: from,
        dateTo: today,
        adherencePercent: null,
        taken: 0,
        skipped: 0,
        missed: missedCount,
      });
    } catch (e) {
      console.error('[caretaker-dose-notify] escalation email failed', to, e);
    }
  }
}
