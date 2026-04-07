/**
 * Adherence scoring: (taken ÷ total scheduled doses) × 100.
 * Exported functions are pure and reusable from tests or future dashboards.
 */
import { Injectable } from '@angular/core';
import { DoseLogEntry, Medication } from '../models/med.models';

/** Summary of adherence for a date range (inclusive). */
export interface AdherencePeriodSummary {
  /** Sum of scheduled dose slots: each enabled medication × each reminder time × each day in range */
  totalScheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  /** (taken / totalScheduled) × 100; null when no scheduled doses */
  adherencePercent: number | null;
  dateFrom: string;
  dateTo: string;
}

/** Format local calendar date as YYYY-MM-DD */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday start of the week containing `d` (local time). */
export function startOfIsoWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** End of ISO week (Sunday) for the week that starts on `monday`. */
export function endOfIsoWeekSunday(monday: Date): Date {
  const sun = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  sun.setHours(0, 0, 0, 0);
  return sun;
}

/** Inclusive list of YYYY-MM-DD strings from `from` through `to` (inclusive). */
export function enumerateDatesInclusive(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }
  const out: string[] = [];
  const [y0, m0, d0] = from.split('-').map(Number);
  const [y1, m1, d1] = to.split('-').map(Number);
  const start = new Date(y0, m0 - 1, d0);
  const end = new Date(y1, m1 - 1, d1);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(formatLocalDate(new Date(t)));
  }
  return out;
}

/** Scheduled dose count for fixed medication list across listed dates. */
export function countScheduledDoses(medications: Medication[], dates: string[]): number {
  const enabled = medications.filter((m) => m.enabled);
  if (enabled.length === 0 || dates.length === 0) {
    return 0;
  }
  let n = 0;
  for (const _ of dates) {
    for (const m of enabled) {
      n += m.times.length;
    }
  }
  return n;
}

/**
 * Adherence % = (taken / totalScheduled) × 100.
 * Counts only logs whose date falls in [dateFrom, dateTo].
 */
export function summarizeAdherencePeriod(
  logs: DoseLogEntry[],
  medications: Medication[],
  dateFrom: string,
  dateTo: string
): AdherencePeriodSummary {
  const dates = enumerateDatesInclusive(dateFrom, dateTo);
  const totalScheduled = countScheduledDoses(medications, dates);

  let taken = 0;
  let missed = 0;
  let skipped = 0;
  for (const l of logs) {
    if (l.date < dateFrom || l.date > dateTo) {
      continue;
    }
    if (l.status === 'taken') {
      taken++;
    } else if (l.status === 'missed') {
      missed++;
    } else if (l.status === 'skipped') {
      skipped++;
    }
  }

  const adherencePercent =
    totalScheduled === 0 ? null : Math.round((taken / totalScheduled) * 1000) / 10;

  return {
    totalScheduled,
    taken,
    missed,
    skipped,
    adherencePercent,
    dateFrom,
    dateTo,
  };
}

@Injectable({ providedIn: 'root' })
export class AdherenceService {
  /** { monday, sunday } as YYYY-MM-DD for the ISO week containing `ref`. */
  currentIsoWeekBounds(ref: Date = new Date()): { monday: string; sunday: string } {
    const monday = startOfIsoWeekMonday(ref);
    const sunday = endOfIsoWeekSunday(monday);
    return {
      monday: formatLocalDate(monday),
      sunday: formatLocalDate(sunday),
    };
  }

  summarizePeriod(
    logs: DoseLogEntry[],
    medications: Medication[],
    dateFrom: string,
    dateTo: string
  ): AdherencePeriodSummary {
    return summarizeAdherencePeriod(logs, medications, dateFrom, dateTo);
  }

  /** Today's adherence only (same formula as period with a single day). */
  todayAdherence(medications: Medication[], logsForToday: DoseLogEntry[], today: string): AdherencePeriodSummary {
    return summarizeAdherencePeriod(logsForToday, medications, today, today);
  }
}
