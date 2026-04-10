import { queryAll, queryOne } from './db.js';
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
  if (payload.status !== 'skipped' && payload.status !== 'missed') {
    return;
  }
  if (!isSmtpConfigured()) {
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

  const linked = await queryAll<{ email: string }>(
    `SELECT u.email FROM caretaker_links cl
     INNER JOIN users u ON u.id = cl.caretaker_user_id
     WHERE cl.profile_id = ?`,
    [payload.profileId]
  );
  for (const l of linked) {
    if (l.email?.trim()) {
      emails.add(l.email.trim().toLowerCase());
    }
  }

  const statusLabel = payload.status === 'skipped' ? 'skipped' : 'missed';
  for (const to of emails) {
    try {
      await sendCaretakerDoseAlertEmail(to, {
        profileName: payload.profileName,
        medicationName: payload.medicationName,
        date: payload.date,
        scheduledTime: payload.scheduledTime,
        statusLabel,
      });
    } catch (e) {
      console.error('[caretaker-dose-notify] send failed', to, e);
    }
  }
}
