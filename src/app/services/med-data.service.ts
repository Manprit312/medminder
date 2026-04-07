import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { DoseLogEntry, Medication, Profile, TodayDose } from '../models/med.models';
import { AuthService } from './auth.service';
import { getApiUrl } from '../../environments/api-url';
import { CaregiverAlertService } from './caregiver/caregiver-alert.service';

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function doseKey(medicationId: string, date: string, time: string): string {
  return `${medicationId}|${date}|${time}`;
}

interface ApiProfile {
  id: string;
  name: string;
  created_at: string;
  caregiverEmail?: string;
  caregiverPhone?: string;
}

interface ApiMedication {
  id: string;
  profileId: string;
  name: string;
  dosageNote?: string;
  times: string[];
  enabled: boolean;
  remainingQuantity?: number;
  pillsPerIntake?: number;
}

interface ApiDoseLog {
  id: string;
  medicationId: string;
  date: string;
  scheduledTime: string;
  status: 'taken' | 'skipped' | 'missed' | string;
  loggedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MedDataService {
  private profiles$ = new BehaviorSubject<Profile[]>([]);
  private medications$ = new BehaviorSubject<Medication[]>([]);
  private logs$ = new BehaviorSubject<DoseLogEntry[]>([]);

  readonly profiles = this.profiles$.asObservable();
  readonly medications = this.medications$.asObservable();
  readonly logs = this.logs$.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly caregiverAlerts: CaregiverAlertService
  ) {}

  private base(): string {
    return getApiUrl();
  }

  /** Load from API when logged in; clear when not */
  async load(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.clear();
      return;
    }
    await this.refresh();
  }

  /** Re-fetch profiles, medications, today's logs */
  async refresh(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.clear();
      return;
    }
    try {
      const profRes = await firstValueFrom(
        this.http.get<{ profiles: ApiProfile[] }>(`${this.base()}/api/profiles`)
      );
      const profiles: Profile[] = profRes.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.created_at,
        caregiverEmail: p.caregiverEmail,
        caregiverPhone: p.caregiverPhone,
      }));
      profiles.sort((a, b) => a.name.localeCompare(b.name));

      const meds: Medication[] = [];
      for (const p of profiles) {
        const mr = await firstValueFrom(
          this.http.get<{ medications: ApiMedication[] }>(
            `${this.base()}/api/profiles/${p.id}/medications`
          )
        );
        for (const m of mr.medications) {
          meds.push({
            id: m.id,
            profileId: m.profileId,
            name: m.name,
            dosageNote: m.dosageNote,
            times: m.times,
            enabled: m.enabled,
            remainingQuantity: m.remainingQuantity,
            pillsPerIntake: m.pillsPerIntake ?? 1,
          });
        }
      }

      const date = todayStr();
      const lr = await firstValueFrom(
        this.http.get<{ logs: ApiDoseLog[] }>(
          `${this.base()}/api/dose-logs?date=${encodeURIComponent(date)}`
        )
      );
      const logs: DoseLogEntry[] = lr.logs.map((l) => ({
        id: l.id,
        medicationId: l.medicationId,
        date: l.date,
        scheduledTime: l.scheduledTime,
        status: l.status as DoseLogEntry['status'],
        loggedAt: l.loggedAt,
      }));

      this.profiles$.next(profiles);
      this.medications$.next(meds);
      this.logs$.next(logs);
    } catch (err) {
      console.error('MedData refresh failed', err);
    }
  }

  clear(): void {
    this.profiles$.next([]);
    this.medications$.next([]);
    this.logs$.next([]);
  }

  getProfilesSnapshot(): Profile[] {
    return [...this.profiles$.value];
  }

  getMedicationsSnapshot(): Medication[] {
    return [...this.medications$.value];
  }

  getLogsSnapshot(): DoseLogEntry[] {
    return [...this.logs$.value];
  }

  getProfile(id: string): Profile | undefined {
    return this.profiles$.value.find((x) => x.id === id);
  }

  getMedicationsForProfile(profileId: string): Medication[] {
    return this.medications$.value.filter((m) => m.profileId === profileId);
  }

  getMedicationById(medicationId: string): Medication | undefined {
    return this.medications$.value.find((m) => m.id === medicationId);
  }

  async createProfile(
    name: string,
    caregiver?: { email?: string; phone?: string }
  ): Promise<Profile> {
    const res = await firstValueFrom(
      this.http.post<{ profile: ApiProfile }>(`${this.base()}/api/profiles`, {
        name: name.trim(),
        caregiverEmail: caregiver?.email ?? '',
        caregiverPhone: caregiver?.phone ?? '',
      })
    );
    const p: Profile = {
      id: res.profile.id,
      name: res.profile.name,
      createdAt: res.profile.created_at,
      caregiverEmail: res.profile.caregiverEmail,
      caregiverPhone: res.profile.caregiverPhone,
    };
    await this.refresh();
    return p;
  }

  async updateProfile(
    id: string,
    name: string,
    caregiver?: { email?: string; phone?: string }
  ): Promise<void> {
    await firstValueFrom(
      this.http.patch<{ profile: ApiProfile }>(`${this.base()}/api/profiles/${id}`, {
        name: name.trim(),
        caregiverEmail: caregiver?.email ?? '',
        caregiverPhone: caregiver?.phone ?? '',
      })
    );
    await this.refresh();
  }

  async deleteProfile(profileId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base()}/api/profiles/${profileId}`));
    await this.refresh();
  }

  async createMedication(
    profileId: string,
    body: {
      name: string;
      dosageNote?: string;
      times: string[];
      enabled: boolean;
      remainingQuantity?: number | null;
      pillsPerIntake?: number;
    }
  ): Promise<Medication> {
    const res = await firstValueFrom(
      this.http.post<{ medication: ApiMedication }>(`${this.base()}/api/profiles/${profileId}/medications`, {
        name: body.name.trim(),
        dosageNote: body.dosageNote?.trim() || undefined,
        times: body.times,
        enabled: body.enabled,
        remainingQuantity:
          body.remainingQuantity === undefined || body.remainingQuantity === null
            ? undefined
            : body.remainingQuantity,
        pillsPerIntake: body.pillsPerIntake ?? 1,
      })
    );
    const m = res.medication;
    const med: Medication = {
      id: m.id,
      profileId: m.profileId,
      name: m.name,
      dosageNote: m.dosageNote,
      times: m.times,
      enabled: m.enabled,
      remainingQuantity: m.remainingQuantity,
      pillsPerIntake: m.pillsPerIntake ?? 1,
    };
    await this.refresh();
    return med;
  }

  async updateMedication(medication: Medication): Promise<void> {
    await firstValueFrom(
      this.http.patch<{ medication: ApiMedication }>(`${this.base()}/api/medications/${medication.id}`, {
        name: medication.name,
        dosageNote: medication.dosageNote ?? null,
        times: medication.times,
        enabled: medication.enabled,
        remainingQuantity:
          medication.remainingQuantity === undefined ? undefined : medication.remainingQuantity,
        pillsPerIntake: medication.pillsPerIntake ?? 1,
      })
    );
    await this.refresh();
  }

  async deleteMedication(medicationId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base()}/api/medications/${medicationId}`));
    await this.refresh();
  }

  /** Load dose logs for an inclusive date range (for adherence / summaries). Does not replace in-memory today logs. */
  async fetchDoseLogsRange(from: string, to: string): Promise<DoseLogEntry[]> {
    const res = await firstValueFrom(
      this.http.get<{ logs: ApiDoseLog[] }>(
        `${this.base()}/api/dose-logs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
    );
    return res.logs.map((l) => ({
      id: l.id,
      medicationId: l.medicationId,
      date: l.date,
      scheduledTime: l.scheduledTime,
      status: l.status as DoseLogEntry['status'],
      loggedAt: l.loggedAt,
    }));
  }

  async logDose(
    medicationId: string,
    scheduledTime: string,
    status: 'taken' | 'skipped' | 'missed'
  ): Promise<void> {
    const date = todayStr();
    await firstValueFrom(
      this.http.post(`${this.base()}/api/dose-logs`, {
        medicationId,
        date,
        scheduledTime,
        status,
      })
    );
    await this.refresh();
    if (status === 'missed') {
      const med = this.getMedicationById(medicationId);
      const profile = med ? this.getProfile(med.profileId) : undefined;
      if (profile && med) {
        await this.caregiverAlerts.notifyMissedDose({
          profileId: profile.id,
          profileName: profile.name,
          medicationName: med.name,
          scheduledTime,
          date,
          caregiverEmail: profile.caregiverEmail,
          caregiverPhone: profile.caregiverPhone,
        });
      }
    }
  }

  getTodayDoses(): TodayDose[] {
    const date = todayStr();
    const profiles = this.profiles$.value;
    const profileMap = new Map(profiles.map((p) => [p.id, p.name]));
    const meds = this.medications$.value.filter((m) => m.enabled);
    const logMap = new Map<string, DoseLogEntry>();
    for (const l of this.logs$.value) {
      if (l.date === date) {
        logMap.set(doseKey(l.medicationId, l.date, l.scheduledTime), l);
      }
    }

    const out: TodayDose[] = [];
    for (const m of meds) {
      const profileName = profileMap.get(m.profileId) ?? 'Unknown';
      for (const time of m.times) {
        const key = doseKey(m.id, date, time);
        const log = logMap.get(key);
        let s: TodayDose['status'] = 'pending';
        if (log) {
          if (log.status === 'taken') {
            s = 'taken';
          } else if (log.status === 'skipped') {
            s = 'skipped';
          } else {
            s = 'missed';
          }
        }
        out.push({
          key,
          medicationId: m.id,
          profileId: m.profileId,
          profileName,
          medName: m.name,
          dosageNote: m.dosageNote,
          time,
          status: s,
        });
      }
    }
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }
}
