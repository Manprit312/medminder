import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ViewWillEnter } from '@ionic/angular';
import { Medication, TodayDose } from '../../models/med.models';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
import { AdherencePeriodSummary, AdherenceService, formatLocalDate } from '../../services/adherence.service';
import { DailyMeals, MealLogService } from '../../services/meal-log.service';
import { MedDataService } from '../../services/med-data.service';
import { RefillService } from '../../services/refill.service';

@Component({
  selector: 'app-today',
  templateUrl: './today.page.html',
  styleUrls: ['./today.page.scss'],
  standalone: false,
})
export class TodayPage implements ViewWillEnter {
  /** True while `refresh()` / summaries run for this visit. */
  loading = true;
  doses: TodayDose[] = [];
  /** Calendar date for headings (refreshed when screen loads) */
  todayDate = new Date();
  /** Today's adherence (taken / scheduled × 100) */
  todaySummary: AdherencePeriodSummary | null = null;
  /** Current ISO week (Mon–Sun) */
  weeklySummary: AdherencePeriodSummary | null = null;
  /** Full-screen expanded detail (same tone as tapped stack card) */
  expandedDose: TodayDose | null = null;
  expandedDeckIndex = 0;

  /** Local date key (YYYY-MM-DD) for meal journal persistence */
  mealLogDateKey = '';
  /** Optional notes — synced to device storage only */
  mealDraft: DailyMeals = { breakfast: '', lunch: '', dinner: '' };

  constructor(
    private readonly medData: MedDataService,
    private readonly adherence: AdherenceService,
    private readonly refill: RefillService,
    private readonly router: Router,
    private readonly mealLog: MealLogService,
    private readonly loadingCtrl: LoadingController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.loading = true;
    this.expandedDose = null;
    this.mealLogDateKey = formatLocalDate(new Date());
    try {
      await this.medData.refresh();
      this.refreshLocal();
      await this.refreshWeeklySummary();
      await this.loadMealsForToday();
    } finally {
      this.loading = false;
    }
  }

  refreshLocal(): void {
    this.todayDate = new Date();
    this.doses = this.medData.getTodayDoses();
    this.updateTodayAdherence();
  }

  private async loadMealsForToday(): Promise<void> {
    this.mealDraft = await this.mealLog.getForDate(this.mealLogDateKey);
  }

  async saveMealsJournal(): Promise<void> {
    const overlay = await this.loadingCtrl.create({ message: 'Saving journal…' });
    await overlay.present();
    try {
      await this.mealLog.saveForDate(this.mealLogDateKey, { ...this.mealDraft });
    } finally {
      await overlay.dismiss();
    }
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

  /** Chronological order for stacked “reminder” cards */
  get dosesSorted(): TodayDose[] {
    return [...this.doses].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }

  /**
   * Deck order: same as chronological, but the “next upcoming” pending dose (if any) is moved to
   * the end so it sits on top of the stack like the reference UI.
   */
  get dosesForDeck(): TodayDose[] {
    const sorted = this.dosesSorted;
    const next = this.nextUpcomingPending;
    if (!next) {
      return sorted;
    }
    const rest = sorted.filter((d) => d.key !== next.key);
    return [...rest, next];
  }

  /** Next upcoming pending dose (future time today), for “Next in … min” */
  get nextUpcomingPending(): TodayDose | null {
    for (const d of this.dosesSorted) {
      if (d.status !== 'pending') {
        continue;
      }
      const m = this.minutesUntilScheduled(d.time);
      if (m != null && m > 0) {
        return d;
      }
    }
    return null;
  }

  slotLabel(time: string): string {
    const [h] = time.split(':').map(Number);
    if (h >= 5 && h < 12) {
      return 'Morning';
    }
    if (h >= 12 && h < 17) {
      return 'Afternoon';
    }
    if (h >= 17 && h < 21) {
      return 'Evening';
    }
    return 'Bedtime';
  }

  /** Visual variety for stacked cards (next-upcoming uses cream via `reminderCardClass`). */
  cardToneClass(index: number): string {
    const tones = ['mm-rc-sage', 'mm-rc-teal', 'mm-rc-taupe'];
    return tones[index % tones.length];
  }

  reminderCardClass(dose: TodayDose, index: number): string {
    const tone = this.isNextUpcoming(dose) ? 'mm-rc-cream' : this.cardToneClass(index);
    return `mm-reminder-card mm-track-card ${tone}`;
  }

  /** Skin after next-upcoming cream override — drives time-pill colors. */
  trackSkin(dose: TodayDose, index: number): 'cream' | 'sage' | 'teal' | 'taupe' {
    if (this.isNextUpcoming(dose)) {
      return 'cream';
    }
    const cycle: ('sage' | 'teal' | 'taupe')[] = ['sage', 'teal', 'taupe'];
    return cycle[index % cycle.length];
  }

  timePillClass(dose: TodayDose, index: number): string {
    return `mm-track-pill mm-track-pill--${this.trackSkin(dose, index)}`;
  }

  /** Short instruction under the medicine name (dose note or fallback). */
  instructionLine(dose: TodayDose): string {
    const note = dose.dosageNote?.trim();
    if (note) {
      return note;
    }
    return `Reminder for ${dose.profileName}. Tap for details or to log this dose.`;
  }

  /** Bottom card in the list sits on top of the stack (deck order). */
  deckZIndex(index: number): number {
    return 1 + index;
  }

  minutesUntilScheduled(time: string): number | null {
    const [th, tm] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(th, tm, 0, 0);
    const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
    if (diffMin <= 0) {
      return null;
    }
    return diffMin;
  }

  formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m ?? 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  frequencyPhrase(dose: TodayDose): string {
    const med = this.medForDose(dose);
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

  isNextUpcoming(dose: TodayDose): boolean {
    const next = this.nextUpcomingPending;
    return next != null && next.key === dose.key;
  }

  cardKicker(dose: TodayDose): string {
    if (this.isNextUpcoming(dose)) {
      const m = this.minutesUntilScheduled(dose.time);
      if (m != null && m > 0) {
        return `Next medicine in ${m} min`;
      }
    }
    return `${this.slotLabel(dose.time)} medicine`;
  }

  get progressFraction(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return this.takenCount / this.totalCount;
  }

  openDose(dose: TodayDose): void {
    const idx = this.dosesForDeck.findIndex((d) => d.key === dose.key);
    this.expandedDeckIndex = idx >= 0 ? idx : 0;
    this.expandedDose = dose;
  }

  closeExpanded(): void {
    this.expandedDose = null;
  }

  /** Jump to medication form (times, stock, notes) without going through Family. */
  openEditMedication(dose: TodayDose): void {
    this.expandedDose = null;
    void this.router.navigateByUrl(
      `/tabs/profiles/${dose.profileId}/medications/${dose.medicationId}`
    );
  }

  expandedToneClass(): string {
    if (!this.expandedDose) {
      return 'mm-rc-sage';
    }
    return this.isNextUpcoming(this.expandedDose)
      ? 'mm-rc-cream'
      : this.cardToneClass(this.expandedDeckIndex);
  }

  expandedMedication(): Medication | undefined {
    return this.expandedDose ? this.medForDose(this.expandedDose) : undefined;
  }

  formatTimesList(med: Medication | undefined): string {
    if (!med?.times?.length) {
      return '—';
    }
    return med.times.map((t) => this.formatTime12h(t)).join(' · ');
  }

  frequencyPhraseMed(med: Medication | undefined): string {
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

  estimatedDaysRemainingMed(med: Medication | undefined): string | null {
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

  async markExpanded(status: 'taken' | 'skipped' | 'missed'): Promise<void> {
    if (!this.expandedDose) {
      return;
    }
    const key = this.expandedDose.key;
    await this.mark(this.expandedDose, status);
    const next = this.medData.getTodayDoses().find((d) => d.key === key);
    if (next) {
      this.expandedDose = next;
    }
  }

  async mark(dose: TodayDose, status: 'taken' | 'skipped' | 'missed'): Promise<void> {
    const overlay = await this.loadingCtrl.create({ message: 'Updating dose log…' });
    await overlay.present();
    try {
      await this.medData.logDose(dose.medicationId, dose.time, status);
      this.refreshLocal();
      await this.refreshWeeklySummary();
    } finally {
      await overlay.dismiss();
    }
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
