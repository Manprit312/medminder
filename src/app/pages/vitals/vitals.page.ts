import { Component } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { Profile } from '../../models/med.models';
import { MedDataService } from '../../services/med-data.service';
import { VitalReading, VitalsStorageService } from '../../services/vitals-storage.service';

@Component({
  selector: 'app-vitals',
  templateUrl: './vitals.page.html',
  styleUrls: ['./vitals.page.scss'],
  standalone: false,
})
export class VitalsPage implements ViewWillEnter {
  profiles: Profile[] = [];
  selectedProfileId = '';

  /** Form (string for ion-input; parsed on save) */
  formSystolic = '';
  formDiastolic = '';
  formHeartRate = '';
  /** datetime-local value */
  formRecordedAt = '';

  readings: VitalReading[] = [];
  saveError: string | null = null;

  constructor(
    private readonly medData: MedDataService,
    private readonly vitals: VitalsStorageService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.saveError = null;
    await this.medData.refresh();
    this.profiles = this.medData.getProfilesSnapshot();
    if (!this.selectedProfileId && this.profiles.length > 0) {
      this.selectedProfileId = this.profiles[0].id;
    }
    this.resetFormTime();
    await this.loadReadings();
  }

  private resetFormTime(): void {
    const d = new Date();
    const pad = (n: number) => `${n}`.padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    this.formRecordedAt = local;
  }

  private async loadReadings(): Promise<void> {
    if (!this.selectedProfileId) {
      this.readings = [];
      return;
    }
    this.readings = await this.vitals.getForProfile(this.selectedProfileId);
  }

  async onProfileChange(): Promise<void> {
    await this.loadReadings();
  }

  parseOptionalInt(raw: string): number | undefined {
    const t = raw.trim();
    if (!t) {
      return undefined;
    }
    const n = Math.floor(Number(t));
    if (!Number.isFinite(n) || n < 0 || n > 400) {
      return undefined;
    }
    return n;
  }

  async saveReading(): Promise<void> {
    this.saveError = null;
    if (!this.selectedProfileId) {
      this.saveError = 'Choose a profile first.';
      return;
    }

    const sys = this.parseOptionalInt(this.formSystolic);
    const dia = this.parseOptionalInt(this.formDiastolic);
    const hr = this.parseOptionalInt(this.formHeartRate);

    const hasBp = sys != null && dia != null;
    const hasPartialBp = (sys != null) !== (dia != null);
    if (hasPartialBp) {
      this.saveError = 'Enter both blood pressure numbers, or leave both empty.';
      return;
    }
    if (!hasBp && hr == null) {
      this.saveError = 'Enter blood pressure (systolic and diastolic) and/or heart rate.';
      return;
    }
    if (hasBp && sys <= dia) {
      this.saveError = 'Systolic is usually higher than diastolic. Check your numbers.';
      return;
    }

    const recorded = new Date(this.formRecordedAt);
    if (Number.isNaN(recorded.getTime())) {
      this.saveError = 'Invalid date/time.';
      return;
    }

    await this.vitals.add({
      profileId: this.selectedProfileId,
      recordedAt: recorded.toISOString(),
      systolic: sys,
      diastolic: dia,
      heartRateBpm: hr,
    });

    this.formSystolic = '';
    this.formDiastolic = '';
    this.formHeartRate = '';
    this.resetFormTime();
    await this.loadReadings();
  }

  async deleteReading(r: VitalReading): Promise<void> {
    await this.vitals.remove(r.id);
    await this.loadReadings();
  }

  formatWhen(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  formatReadingLine(r: VitalReading): string {
    const parts: string[] = [];
    if (r.systolic != null && r.diastolic != null) {
      parts.push(`BP ${r.systolic}/${r.diastolic}`);
    }
    if (r.heartRateBpm != null) {
      parts.push(`HR ${r.heartRateBpm} bpm`);
    }
    return parts.length > 0 ? parts.join(' · ') : '—';
  }
}
