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
