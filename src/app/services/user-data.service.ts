import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';

interface DoseLog {
  date: string;
  scheduledTime: string;
  status: string;
  loggedAt: string;
}

interface MedExport {
  id: string;
  name: string;
  dosageNote: string | null;
  times: string[];
  enabled: boolean;
  kind: string | null;
  doseLogs: DoseLog[];
}

interface ProfileExport {
  id: string;
  name: string;
  patientGroup: string;
  createdAt: string;
  medications: MedExport[];
}

interface DataExport {
  exportedAt: string;
  account: { email: string; subscriptionTier: string; createdAt: string };
  profiles: ProfileExport[];
}

type LogWithMed = DoseLog & { medName: string };

@Injectable({ providedIn: 'root' })
export class UserDataService {
  constructor(private readonly http: HttpClient) {}

  private triggerDownload(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private fetchExport(): Promise<DataExport> {
    return firstValueFrom(
      withApiTimeout(this.http.get<DataExport>(`${getApiUrl()}/api/user/export`))
    );
  }

  /** Raw JSON — for GDPR/data-portability requests. */
  async downloadJsonExport(): Promise<void> {
    const data = await this.fetchExport();
    this.triggerDownload(
      JSON.stringify(data, null, 2),
      `medminder-data-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
  }

  /**
   * Human-readable HTML medical report — formatted for sharing with a doctor.
   * Opens in a new tab so the user can print or save as PDF.
   * The window must be opened synchronously (before the await) to avoid popup blockers.
   */
  async openMedicalReport(): Promise<void> {
    const win = window.open('', '_blank');
    if (!win) {
      throw new Error('Popup blocked — allow popups for this site and try again.');
    }
    win.document.write('<p style="font-family:sans-serif;padding:2rem">Loading your report…</p>');
    try {
      const data = await this.fetchExport();
      const html = this.buildReportHtml(data);
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      win.close();
      throw err;
    }
  }

  private fmt(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  private fmtTime(t: string | null | undefined): string {
    if (!t) return '—';
    const parts = t.split(':').map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  private adherence(logs: DoseLog[]): { taken: number; skipped: number; missed: number; pct: number | null } {
    const taken = logs.filter(l => l.status === 'taken').length;
    const skipped = logs.filter(l => l.status === 'skipped').length;
    const missed = logs.filter(l => l.status === 'missed').length;
    const total = taken + skipped + missed;
    return { taken, skipped, missed, pct: total > 0 ? Math.round((taken / total) * 100) : null };
  }

  private buildReportHtml(data: DataExport): string {
    const today = this.fmt(new Date().toISOString().slice(0, 10));
    const generatedAt = new Date(data.exportedAt).toLocaleString();

    const profileSections = data.profiles.map(profile => {
      const allLogs: LogWithMed[] = ([] as LogWithMed[]).concat(
        ...profile.medications.map((m: MedExport) => m.doseLogs.map((l: DoseLog) => ({ ...l, medName: m.name })))
      );
      const { taken, skipped, missed, pct } = this.adherence(allLogs);

      const medRows = profile.medications.map(m => {
        const { pct: mp } = this.adherence(m.doseLogs);
        return `<tr>
          <td><strong>${m.name}</strong>${m.dosageNote ? `<br><span class="note">${m.dosageNote}</span>` : ''}</td>
          <td>${(m.times ?? []).map((t: string) => this.fmtTime(t)).join(', ') || '—'}</td>
          <td>${m.kind ?? '—'}</td>
          <td class="${m.enabled ? 'yes' : 'no'}">${m.enabled ? 'Active' : 'Paused'}</td>
          <td>${mp !== null ? mp + '%' : 'No data'}</td>
        </tr>`;
      }).join('');

      // Dose history — last 30 days grouped by date
      const recentLogs = allLogs
        .filter(l => (l.date ?? '') >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''));

      const logRows = recentLogs.length === 0
        ? '<tr><td colspan="4" class="empty">No dose logs in the last 30 days.</td></tr>'
        : recentLogs.map(l => `<tr>
            <td>${this.fmt(l.date)}</td>
            <td>${l.medName}</td>
            <td>${this.fmtTime(l.scheduledTime ?? undefined)}</td>
            <td><span class="badge badge--${l.status}">${l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span></td>
          </tr>`).join('');

      return `
        <section class="profile-section">
          <h2 class="profile-name">👤 ${profile.name}</h2>

          <h3>Medication Summary</h3>
          <table>
            <thead><tr><th>Medication</th><th>Reminder times</th><th>Type</th><th>Status</th><th>Adherence</th></tr></thead>
            <tbody>${medRows.length ? medRows : '<tr><td colspan="5" class="empty">No medications.</td></tr>'}</tbody>
          </table>

          <h3>Overall Adherence (all time)</h3>
          <div class="stats">
            <div class="stat stat--taken"><span>${taken}</span>Taken</div>
            <div class="stat stat--skipped"><span>${skipped}</span>Skipped</div>
            <div class="stat stat--missed"><span>${missed}</span>Missed</div>
            <div class="stat stat--pct"><span>${pct !== null ? pct + '%' : '—'}</span>Adherence rate</div>
          </div>

          <h3>Dose History — Last 30 Days</h3>
          <table>
            <thead><tr><th>Date</th><th>Medication</th><th>Scheduled time</th><th>Status</th></tr></thead>
            <tbody>${logRows}</tbody>
          </table>
        </section>`;
    }).join('<hr class="divider">');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MedMinder Medical Report — ${today}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1e2b1e; background: #fff; padding: 2rem; max-width: 900px; margin: 0 auto; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4a6840; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .report-header h1 { font-size: 1.5rem; color: #3a5230; }
    .report-header .meta { font-size: .8rem; color: #6b7a6b; text-align: right; line-height: 1.6; }
    .disclaimer { background: #fff8e6; border: 1px solid #f4ddb3; border-radius: 8px; padding: .75rem 1rem; font-size: .78rem; color: #7a5c00; margin-bottom: 1.5rem; }
    .profile-section { margin-bottom: 2rem; }
    .profile-name { font-size: 1.15rem; color: #3a5230; margin-bottom: 1rem; }
    h3 { font-size: .85rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7a6b; margin: 1.25rem 0 .6rem; }
    table { width: 100%; border-collapse: collapse; font-size: .82rem; margin-bottom: .75rem; }
    th { background: #eef3ea; color: #3a5230; font-weight: 700; padding: .5rem .75rem; text-align: left; border-bottom: 2px solid #d4e4cc; }
    td { padding: .45rem .75rem; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .note { color: #6b7a6b; font-size: .78rem; }
    .yes { color: #2e7d32; font-weight: 600; }
    .no  { color: #9e9e9e; }
    .empty { color: #9e9e9e; font-style: italic; padding: 1rem .75rem; }
    .stats { display: flex; gap: 1rem; margin-bottom: .75rem; flex-wrap: wrap; }
    .stat { background: #f7f9f5; border: 1px solid #d4e4cc; border-radius: 10px; padding: .65rem 1rem; text-align: center; min-width: 90px; }
    .stat span { display: block; font-size: 1.4rem; font-weight: 800; color: #3a5230; }
    .stat--taken  span { color: #2e7d32; }
    .stat--skipped span { color: #b07800; }
    .stat--missed  span { color: #c0392b; }
    .stat--pct     span { color: #3a5230; }
    .badge { display: inline-block; padding: .15rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 700; }
    .badge--taken   { background: #b8e3c3; color: #1a3d1a; }
    .badge--skipped { background: #f4ddb3; color: #4d3300; }
    .badge--missed  { background: #f7b8b8; color: #5c0000; }
    .badge--pending { background: #e8e8e8; color: #555; }
    .divider { border: none; border-top: 1.5px dashed #d4e4cc; margin: 2rem 0; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: .75rem; color: #9e9e9e; text-align: center; }
    @media print {
      body { padding: 1rem; }
      .no-print { display: none; }
      .profile-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <h1>💊 MedMinder Medical Report</h1>
      <p style="color:#6b7a6b;font-size:.85rem;margin-top:.25rem">Medication tracking summary for clinical review</p>
    </div>
    <div class="meta">
      <p><strong>Account:</strong> ${data.account.email}</p>
      <p><strong>Report date:</strong> ${today}</p>
      <p><strong>Generated:</strong> ${generatedAt}</p>
    </div>
  </div>

  <div class="disclaimer">
    ⚕️ <strong>For clinical reference only.</strong> This report reflects self-reported medication logs entered by the patient in MedMinder. It is not a substitute for professional medical records. Please verify with the patient before making clinical decisions.
  </div>

  <div class="no-print" style="margin-bottom:1.5rem">
    <button onclick="window.print()" style="background:#4a6840;color:#fff;border:none;border-radius:8px;padding:.6rem 1.25rem;font-size:.9rem;font-weight:600;cursor:pointer">🖨️ Print / Save as PDF</button>
  </div>

  ${profileSections || '<p style="color:#9e9e9e">No profiles found.</p>'}

  <div class="footer">
    Generated by MedMinder · ${generatedAt} · This report is for informational purposes only.
  </div>
</body>
</html>`;
  }

  /** Permanently deletes the account and all associated data on the backend. */
  async deleteAccount(): Promise<void> {
    await firstValueFrom(
      withApiTimeout(this.http.delete<{ ok: boolean }>(`${getApiUrl()}/api/user/account`))
    );
  }
}
