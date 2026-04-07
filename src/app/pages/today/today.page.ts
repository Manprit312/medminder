import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { Medication, TodayDose } from '../../models/med.models';
import { AdherencePeriodSummary, AdherenceService, formatLocalDate } from '../../services/adherence.service';
import { MedDataService } from '../../services/med-data.service';
import { RefillService } from '../../services/refill.service';

@Component({
  selector: 'app-today',
  templateUrl: './today.page.html',
  styleUrls: ['./today.page.scss'],
  standalone: false,
})
export class TodayPage implements ViewWillEnter {
  doses: TodayDose[] = [];
  /** Calendar date for headings (refreshed when screen loads) */
  todayDate = new Date();
  /** Today's adherence (taken / scheduled × 100) */
  todaySummary: AdherencePeriodSummary | null = null;
  /** Current ISO week (Mon–Sun) */
  weeklySummary: AdherencePeriodSummary | null = null;

  constructor(
    private readonly medData: MedDataService,
    private readonly adherence: AdherenceService,
    private readonly router: Router,
    private readonly refill: RefillService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.medData.refresh();
    this.refreshLocal();
    await this.refreshWeeklySummary();
  }

  refreshLocal(): void {
    this.todayDate = new Date();
    this.doses = this.medData.getTodayDoses();
    this.updateTodayAdherence();
  }

  private updateTodayAdherence(): void {
    const meds = this.medData.getMedicationsSnapshot();
    const day = formatLocalDate(new Date());
    const logsToday = this.medData.getLogsSnapshot().filter((l) => l.date === day);
    this.todaySummary = this.adherence.todayAdherence(meds, logsToday, day);
  }

  private async refreshWeeklySummary(): Promise<void> {
    const { monday, sunday } = this.adherence.currentIsoWeekBounds();
    try {
      const weekLogs = await this.medData.fetchDoseLogsRange(monday, sunday);
      this.weeklySummary = this.adherence.summarizePeriod(
        weekLogs,
        this.medData.getMedicationsSnapshot(),
        monday,
        sunday
      );
    } catch (err) {
      console.error('Weekly adherence fetch failed', err);
      this.weeklySummary = null;
    }
  }

  get totalCount(): number {
    return this.doses.length;
  }

  get takenCount(): number {
    return this.doses.filter((d) => d.status === 'taken').length;
  }

  get skippedCount(): number {
    return this.doses.filter((d) => d.status === 'skipped').length;
  }

  get missedCount(): number {
    return this.doses.filter((d) => d.status === 'missed').length;
  }

  get pendingCount(): number {
    return this.doses.filter((d) => d.status === 'pending').length;
  }

  /** Pending only, by scheduled time */
  get pendingDoses(): TodayDose[] {
    return this.doses.filter((d) => d.status === 'pending');
  }

  /** Taken or skipped today, by time */
  get loggedDoses(): TodayDose[] {
    return this.doses.filter((d) => d.status !== 'pending');
  }

  get progressFraction(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return this.takenCount / this.totalCount;
  }

  timeToken(time: string): string {
    return time.replace(/:/g, '-');
  }

  openDose(dose: TodayDose): void {
    void this.router.navigate([
      '/tabs/today/dose',
      dose.medicationId,
      this.timeToken(dose.time),
    ]);
  }

  async mark(dose: TodayDose, status: 'taken' | 'skipped' | 'missed'): Promise<void> {
    await this.medData.logDose(dose.medicationId, dose.time, status);
    this.refreshLocal();
    await this.refreshWeeklySummary();
  }

  medForDose(dose: TodayDose): Medication | undefined {
    return this.medData.getMedicationById(dose.medicationId);
  }

  runOutLine(dose: TodayDose): string | null {
    const m = this.medForDose(dose);
    return m ? this.refill.runOutMessage(m) : null;
  }

  warnRefill(dose: TodayDose): boolean {
    const m = this.medForDose(dose);
    return m ? this.refill.shouldWarnRefill(m) : false;
  }
}
