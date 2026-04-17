import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ViewWillEnter } from '@ionic/angular';
import { DoseLogEntry, Medication, TodayDose } from '../../models/med.models';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
import {
  AdherencePeriodSummary,
  AdherenceService,
  enumerateDatesInclusive,
  formatLocalDate,
} from '../../services/adherence.service';
import { DailyMeals, MealLogService } from '../../services/meal-log.service';
import { MedDataService } from '../../services/med-data.service';
import { RefillService } from '../../services/refill.service';
import { DoseCheckinLevel, HealthAssistantService } from '../../services/health-assistant.service';

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
  /** Selected calendar day shown on this screen (defaults to today). */
  selectedDate = new Date();
  selectedDateKey = formatLocalDate(new Date());
  /** Selected-day adherence (taken / scheduled × 100) */
  todaySummary: AdherencePeriodSummary | null = null;
  /** ISO week (Mon–Sun) for the selected day */
  weeklySummary: AdherencePeriodSummary | null = null;
  /** Mini week chart: one cell per day Mon–Sun */
  weekStrip: { label: string; tone: 'empty' | 'bad' | 'mid' | 'good' }[] = [];
  /** Full-screen expanded detail (same tone as tapped stack card) */
  expandedDose: TodayDose | null = null;
  expandedDeckIndex = 0;
  expandedHistoryLoading = false;
  expandedDateStatus: 'taken' | 'skipped' | 'missed' | 'pending' = 'pending';
  historyStatusByDate: Record<string, 'taken' | 'skipped' | 'missed'> = {};

  /** Local date key (YYYY-MM-DD) for meal journal persistence */
  mealLogDateKey = '';
  /** Optional notes — synced to device storage only */
  mealDraft: DailyMeals = { breakfast: '', lunch: '', dinner: '' };
  assistantBullets: string[] = [];
  assistantFooter = '';
  checkinByDoseKey: Record<string, DoseCheckinLevel> = {};

  constructor(
    private readonly medData: MedDataService,
    private readonly adherence: AdherenceService,
    private readonly refill: RefillService,
    private readonly router: Router,
    private readonly mealLog: MealLogService,
    private readonly loadingCtrl: LoadingController,
    private readonly assistant: HealthAssistantService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.loading = true;
    this.expandedDose = null;
    this.selectedDate = new Date();
    this.selectedDateKey = formatLocalDate(this.selectedDate);
    this.mealLogDateKey = this.selectedDateKey;
    try {
      await this.medData.refresh();
      await this.refreshForSelectedDate();
    } finally {
      this.loading = false;
    }
  }

  get maxDateKey(): string {
    return formatLocalDate(new Date());
  }

  get isViewingToday(): boolean {
    return this.selectedDateKey === this.maxDateKey;
  }

  /** Friendly greeting from the device clock (shown with today’s date on the home hero). */
  get timeGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) {
      return 'Good morning';
    }
    if (h < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }

  onDateChanged(value: string | null | undefined): void {
    const key = this.normalizeDateValue(value);
    if (!key || key === this.selectedDateKey) {
      return;
    }
    this.selectedDateKey = key;
    this.selectedDate = this.parseLocalDateKey(key);
    this.expandedDateStatus = this.historyStatusByDate[key] ?? 'pending';
    void this.refreshForSelectedDate();
  }

  onHistoryDatePickerChange(event: Event): void {
    const detail = event as CustomEvent<{ value?: string | null }>;
    this.onDateChanged(detail.detail?.value);
  }

  private parseLocalDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  private normalizeDateValue(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }
    return raw.trim().slice(0, 10);
  }

  private async refreshForSelectedDate(): Promise<void> {
    this.mealLogDateKey = this.selectedDateKey;
    this.doses = await this.medData.getDosesForDate(this.selectedDateKey);
    if (this.expandedDose) {
      const synced = this.doses.find(
        (d) =>
          d.medicationId === this.expandedDose!.medicationId &&
          d.time === this.expandedDose!.time &&
          d.profileId === this.expandedDose!.profileId
      );
      if (synced) {
        this.expandedDose = synced;
      }
    }
    await this.updateSelectedDayAdherence();
    await this.refreshWeeklySummary();
    await this.loadMealsForSelectedDate();
    await this.loadCheckinsForSelectedDate();
    this.updateAssistantBriefing();
  }

  private updateAssistantBriefing(): void {
    const bullets: string[] = [];
    const next = this.nextUpcomingPending;
    if (next) {
      bullets.push(`Next dose: ${next.medName} at ${this.formatTime12h(next.time)}.`);
    }
    if (this.pendingCount > 0) {
      bullets.push(`${this.pendingCount} dose(s) still pending today.`);
    }
    if (this.missedCount > 0) {
      bullets.push(`${this.missedCount} missed dose(s) logged today. Review and correct if needed.`);
    }
    const low = this.doses.find((d) => this.warnRefill(d));
    if (low) {
      bullets.push(`Refill soon: ${low.medName}.`);
    }
    if (bullets.length === 0) {
      bullets.push("You're on track today. Keep your routine steady.");
    }
    this.assistantBullets = bullets.slice(0, 4);
    this.assistantFooter = 'Assistant guidance is educational only and does not replace clinician advice.';
  }

  private doseCheckinKey(dose: TodayDose): string {
    return `${dose.medicationId}|${this.selectedDateKey}|${dose.time}`;
  }

  private async loadCheckinsForSelectedDate(): Promise<void> {
    const map: Record<string, DoseCheckinLevel> = {};
    for (const dose of this.doses) {
      const key = this.doseCheckinKey(dose);
      const v = await this.assistant.getDoseCheckin(key);
      if (v) {
        map[key] = v;
      }
    }
    this.checkinByDoseKey = map;
  }

  doseCheckinStatus(dose: TodayDose): DoseCheckinLevel | null {
    return this.checkinByDoseKey[this.doseCheckinKey(dose)] ?? null;
  }

  async setDoseCheckin(dose: TodayDose, level: DoseCheckinLevel): Promise<void> {
    const key = this.doseCheckinKey(dose);
    await this.assistant.setDoseCheckin(key, level);
    this.checkinByDoseKey = { ...this.checkinByDoseKey, [key]: level };
  }

  private async loadMealsForSelectedDate(): Promise<void> {
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

  /** Primary app action: add medication quickly from Today. */
  addMedicationNow(): void {
    const profiles = this.medData.getProfilesSnapshot();
    if (profiles.length === 0) {
      void this.router.navigateByUrl('/tabs/profiles/add');
      return;
    }
    const profileId = profiles[0].id;
    void this.router.navigateByUrl(`/tabs/profiles/${profileId}/medications/add`);
  }

  private async updateSelectedDayAdherence(): Promise<void> {
    const meds = this.medData.getMedicationsSnapshot();
    const day = this.selectedDateKey;
    const logsToday = await this.medData.fetchDoseLogsRange(day, day);
    this.todaySummary = this.adherence.todayAdherence(meds, logsToday, day);
  }

  private async refreshWeeklySummary(): Promise<void> {
    const { monday, sunday } = this.adherence.currentIsoWeekBounds(this.selectedDate);
    try {
      const weekLogs = await this.medData.fetchDoseLogsRange(monday, sunday);
      const meds = this.medData.getMedicationsSnapshot();
      this.weeklySummary = this.adherence.summarizePeriod(weekLogs, meds, monday, sunday);
      this.buildWeekStrip(monday, sunday, weekLogs, meds);
    } catch (err) {
      console.error('Weekly adherence fetch failed', err);
      this.weeklySummary = null;
      this.weekStrip = [];
    }
  }

  private buildWeekStrip(
    monday: string,
    sunday: string,
    weekLogs: DoseLogEntry[],
    meds: Medication[]
  ): void {
    const dates = enumerateDatesInclusive(monday, sunday);
    this.weekStrip = dates.map((d) => {
      const dayLogs = weekLogs.filter((l) => l.date === d);
      const s = this.adherence.summarizePeriod(dayLogs, meds, d, d);
      const pct = s.adherencePercent;
      let tone: 'empty' | 'bad' | 'mid' | 'good' = 'empty';
      if (s.totalScheduled > 0 && pct != null) {
        if (pct < 40) {
          tone = 'bad';
        } else if (pct < 80) {
          tone = 'mid';
        } else {
          tone = 'good';
        }
      }
      const label = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
      return { label, tone };
    });
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

  /** Whole-number % for UI (matches dose list: taken / scheduled slots). */
  get todayAdherenceDisplayPercent(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return Math.round((this.takenCount / this.totalCount) * 100);
  }

  /**
   * Dynamic progress color: red ≤30%, yellow &lt;70%, green ≥70%.
   * Aligns with ion-progress-bar color tokens.
   */
  get adherenceProgressIonColor(): string {
    if (this.totalCount === 0) {
      return 'medium';
    }
    const p = this.todayAdherenceDisplayPercent;
    if (p <= 30) {
      return 'danger';
    }
    if (p < 70) {
      return 'warning';
    }
    return 'success';
  }

  get doseCountLine(): string {
    return `${this.takenCount}/${this.totalCount} doses taken`;
  }

  get adherenceMicroFeedback(): string {
    if (this.totalCount === 0) {
      return '';
    }
    const f = this.progressFraction;
    if (f === 0) {
      return "Let's get started";
    }
    if (f < 1) {
      return 'Good progress';
    }
    return 'Great job';
  }

  /** Status strip for card tint (pending / taken / skipped / missed). */
  doseCardStatusClass(dose: TodayDose): string {
    return `mm-track-status--${dose.status}`;
  }

  async openDose(dose: TodayDose): Promise<void> {
    const idx = this.dosesForDeck.findIndex((d) => d.key === dose.key);
    this.expandedDeckIndex = idx >= 0 ? idx : 0;
    this.expandedDose = dose;
    await this.loadExpandedHistory(dose);
  }

  closeExpanded(): void {
    this.expandedDose = null;
    this.expandedHistoryLoading = false;
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
    const next = this.doses.find((d) => d.key === key);
    if (next) {
      this.expandedDose = next;
      await this.loadExpandedHistory(next);
    }
  }

  async mark(dose: TodayDose, status: 'taken' | 'skipped' | 'missed'): Promise<void> {
    const overlay = await this.loadingCtrl.create({ message: 'Updating dose log…' });
    await overlay.present();
    try {
      await this.medData.logDose(dose.medicationId, dose.time, status, this.selectedDateKey);
      await this.refreshForSelectedDate();
      if (this.expandedDose && this.expandedDose.key === dose.key) {
        await this.loadExpandedHistory(this.expandedDose);
      }
    } finally {
      await overlay.dismiss();
    }
  }

  private historyAnchorDate(): Date {
    return this.isViewingToday ? new Date() : this.selectedDate;
  }

  private historyDateRange(days: number): { from: string; to: string; dates: string[] } {
    const anchor = this.historyAnchorDate();
    const to = formatLocalDate(anchor);
    const fromDate = new Date(anchor);
    fromDate.setDate(fromDate.getDate() - (days - 1));
    const from = formatLocalDate(fromDate);
    const dates: string[] = [];
    for (let t = fromDate.getTime(); t <= anchor.getTime(); t += 86400000) {
      dates.push(formatLocalDate(new Date(t)));
    }
    return { from, to, dates };
  }

  historyStatusLabel(status: 'taken' | 'skipped' | 'missed' | 'pending'): string {
    if (status === 'taken') {
      return 'Taken';
    }
    if (status === 'skipped') {
      return 'Skipped';
    }
    if (status === 'missed') {
      return 'Missed';
    }
    return 'Not logged';
  }

  historyDateHighlight = (isoDate: string): { textColor: string; backgroundColor: string } | undefined => {
    const key = this.normalizeDateValue(isoDate);
    if (!key) {
      return undefined;
    }
    const s = this.historyStatusByDate[key];
    if (!s) {
      return undefined;
    }
    if (s === 'taken') {
      return { textColor: '#153322', backgroundColor: '#b8e3c3' };
    }
    if (s === 'skipped') {
      return { textColor: '#3f2a08', backgroundColor: '#f4ddb3' };
    }
    return { textColor: '#4c0b0b', backgroundColor: '#f7b8b8' };
  };

  private async loadExpandedHistory(dose: TodayDose): Promise<void> {
    this.expandedHistoryLoading = true;
    try {
      const { from, to } = this.historyDateRange(365);
      const logs = await this.medData.fetchDoseLogsRange(from, to);
      const map = new Map<string, 'taken' | 'skipped' | 'missed'>();
      for (const l of logs) {
        if (l.medicationId !== dose.medicationId || l.scheduledTime !== dose.time) {
          continue;
        }
        const status = l.status === 'taken' || l.status === 'skipped' ? l.status : 'missed';
        map.set(l.date, status);
      }
      const statusByDate: Record<string, 'taken' | 'skipped' | 'missed'> = {};
      for (const [dateKey, status] of map.entries()) {
        statusByDate[dateKey] = status;
      }
      this.historyStatusByDate = statusByDate;
      this.expandedDateStatus = this.historyStatusByDate[this.selectedDateKey] ?? 'pending';
    } catch (err) {
      console.error('Dose history load failed', err);
      this.historyStatusByDate = {};
      this.expandedDateStatus = 'pending';
    } finally {
      this.expandedHistoryLoading = false;
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
