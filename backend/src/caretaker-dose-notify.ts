import { queryAll, queryOne } from './db.js';
import { runExec } from './db.js';
import { isSmtpConfigured, sendCaretakerDoseAlertEmail } from './email.js';

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
}
