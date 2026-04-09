import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { Medication, TodayDose } from '../../models/med.models';
import { MedDataService } from '../../services/med-data.service';
import { RefillService } from '../../services/refill.service';

function decodeTimeToken(token: string): string {
  return token.replace(/-/g, ':');
}

@Component({
  selector: 'app-dose-log',
  templateUrl: './dose-log.page.html',
  styleUrls: ['./dose-log.page.scss'],
  standalone: false,
})
export class DoseLogPage implements ViewWillEnter {
  medicationId = '';
  time = '';
  dose: TodayDose | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    readonly refill: RefillService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.medicationId =
      this.route.snapshot.paramMap.get('medicationId') ??
      this.route.parent?.snapshot.paramMap.get('medicationId') ??
      '';
    const token = this.route.snapshot.paramMap.get('timeToken') ?? '';
    this.time = decodeTimeToken(token);
    await this.medData.refresh();
    this.refreshLocal();
  }

  refreshLocal(): void {
    const list = this.medData.getTodayDoses();
    this.dose =
      list.find((d) => d.medicationId === this.medicationId && d.time === this.time) ?? null;
  }

  get medication(): Medication | undefined {
    return this.medData.getMedicationById(this.medicationId);
  }

  formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m ?? 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  formatTimesList(med: Medication | undefined): string {
    if (!med?.times?.length) {
      return '—';
    }
    return med.times.map((t) => this.formatTime12h(t)).join(' · ');
  }

  frequencyPhrase(med: Medication | undefined): string {
    const n = med?.times?.length ?? 0;
    if (n <= 0) {
      return '—';
    }
    const labels = ['Once', 'Twice', 'Three times', 'Four times', 'Five times', 'Six times'];
    if (n <= 6) {
      return `${labels[n - 1]} a day`;
    }
    return `${n} times a day`;
  }

  kindLabel(med: Medication | undefined): string | null {
    if (!med?.kind) {
      return null;
    }
    const map: Record<string, string> = {
      tablet: 'Tablet',
      capsule: 'Capsule',
      injection: 'Injection',
      other: 'Other',
    };
    return map[med.kind] ?? med.kind;
  }

  /** Rough supply duration when refill data exists */
  estimatedDaysRemaining(med: Medication | undefined): string | null {
    if (!med || med.remainingQuantity == null || !med.times?.length) {
      return null;
    }
    const perDay = med.times.length * (med.pillsPerIntake ?? 1);
    if (perDay <= 0) {
      return null;
    }
    const days = Math.floor(med.remainingQuantity / perDay);
    if (days <= 0) {
      return null;
    }
    return `${days} days`;
  }

  async mark(status: 'taken' | 'skipped' | 'missed'): Promise<void> {
    if (!this.dose) {
      return;
    }
    await this.medData.logDose(this.dose.medicationId, this.dose.time, status);
    this.refreshLocal();
  }

  back(): void {
    void this.router.navigate(['/tabs/today']);
  }
}
