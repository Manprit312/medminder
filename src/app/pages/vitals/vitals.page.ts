import { Component } from '@angular/core';
import { LoadingController, ViewWillEnter } from '@ionic/angular';
import { Profile } from '../../models/med.models';
import { HealthAssistantService, SymptomEntry } from '../../services/health-assistant.service';
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
  formGlucose = '';
  formSpo2 = '';
  /** datetime-local value */
  formRecordedAt = '';

  readings: VitalReading[] = [];
  symptoms: SymptomEntry[] = [];
  symptomTag = 'nausea';
  symptomSeverity: 1 | 2 | 3 | 4 | 5 = 2;
  symptomNotes = '';
  saveError: string | null = null;

  constructor(
    private readonly medData: MedDataService,
    private readonly vitals: VitalsStorageService,
    private readonly assistant: HealthAssistantService,
    private readonly loadingCtrl: LoadingController
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
    await this.loadSymptoms();
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

  private async loadSymptoms(): Promise<void> {
    if (!this.selectedProfileId) {
      this.symptoms = [];
      return;
    }
    this.symptoms = await this.assistant.listSymptoms(this.selectedProfileId);
  }

  async onProfileChange(): Promise<void> {
    await this.loadReadings();
    await this.loadSymptoms();
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
    const glucose = this.parseOptionalInt(this.formGlucose);
    const spo2 = this.parseOptionalInt(this.formSpo2);

    const hasBp = sys != null && dia != null;
    const hasPartialBp = (sys != null) !== (dia != null);
    if (hasPartialBp) {
      this.saveError = 'Enter both blood pressure numbers, or leave both empty.';
      return;
    }
    if (!hasBp && hr == null && glucose == null && spo2 == null) {
      this.saveError = 'Enter at least one reading (BP, heart rate, glucose, or SpO2).';
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

    const loading = await this.loadingCtrl.create({ message: 'Saving reading…' });
    await loading.present();
    try {
      await this.vitals.add({
        profileId: this.selectedProfileId,
        recordedAt: recorded.toISOString(),
        systolic: sys,
        diastolic: dia,
        heartRateBpm: hr,
        glucoseMgDl: glucose,
        spo2Pct: spo2,
      });

      this.formSystolic = '';
      this.formDiastolic = '';
      this.formHeartRate = '';
      this.formGlucose = '';
      this.formSpo2 = '';
      this.resetFormTime();
      await this.loadReadings();
    } finally {
      await loading.dismiss();
    }
  }

  async deleteReading(r: VitalReading): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Removing reading…' });
    await loading.present();
    try {
      await this.vitals.remove(r.id);
      await this.loadReadings();
    } finally {
      await loading.dismiss();
    }
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
    if (r.glucoseMgDl != null) {
      parts.push(`Glucose ${r.glucoseMgDl} mg/dL`);
    }
    if (r.spo2Pct != null) {
      parts.push(`SpO2 ${r.spo2Pct}%`);
    }
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  async addSymptom(): Promise<void> {
    if (!this.selectedProfileId) {
      this.saveError = 'Choose a profile first.';
      return;
    }
    const now = new Date().toISOString();
    await this.assistant.addSymptom({
      profileId: this.selectedProfileId,
      recordedAt: now,
      tag: this.symptomTag,
      severity: this.symptomSeverity,
      notes: this.symptomNotes.trim(),
    });
    this.symptomNotes = '';
    await this.loadSymptoms();
  }

  async removeSymptom(id: string): Promise<void> {
    await this.assistant.removeSymptom(id);
    await this.loadSymptoms();
  }
}
