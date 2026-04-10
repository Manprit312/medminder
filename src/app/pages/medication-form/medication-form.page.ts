import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ViewWillEnter } from '@ionic/angular';
import { Medication, MedicationKind, Profile } from '../../models/med.models';
import { formatApiError } from '../../shared/format-api-error';
import { MedDataService } from '../../services/med-data.service';
import { MedExternalLinksService } from '../../services/med-external-links.service';
import { MedNotificationService } from '../../services/med-notification.service';

@Component({
  selector: 'app-medication-form',
  templateUrl: './medication-form.page.html',
  styleUrls: ['./medication-form.page.scss'],
  standalone: false,
})
export class MedicationFormPage implements OnInit, ViewWillEnter {
  isAdd = true;
  profileId = '';
  medId = '';
  profile: Profile | undefined;

  formName = '';
  formDosage = '';
  /** Blank = not tracking (create omits; edit clears server stock) */
  formRemainingQuantity = '';
  /** Pills taken each time a dose is marked “taken” */
  formPillsPerIntake = 1;
  formTimes: string[] = ['09:00'];
  formEnabled = true;
  /** Add flow: step 1 = choose type (reference UI), step 2 = details */
  addStep: 1 | 2 = 1;
  formKind: MedicationKind | null = null;
  /** False until `refresh()` finishes — avoids “Profile not found” while the API is slow. */
  pageReady = false;

  readonly typeOptions: { id: MedicationKind; label: string; icon: string }[] = [
    { id: 'tablet', label: 'Tablet', icon: 'pill' },
    { id: 'capsule', label: 'Capsule', icon: 'egg_alt' },
    { id: 'injection', label: 'Injection', icon: 'vaccines' },
    { id: 'other', label: 'Other', icon: 'medical_services' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly medLinks: MedExternalLinksService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  /** Lazy-loaded `profiles/:id/medications/...` often keeps `:id` on a parent route — walk the tree. */
  private readRouteParam(name: string): string {
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const v = r.snapshot.paramMap.get(name);
      if (v) {
        return v;
      }
      r = r.parent;
    }
    return '';
  }

  /**
   * Ionic stack + lazy children sometimes omit params on `ActivatedRoute` snapshots.
   * URL is the source of truth for `/tabs/profiles/:id/medications/(add|:medId)`.
   */
  private readMedicationIdsFromUrl(): { profileId: string; medId: string } {
    const path = this.router.url.split(/[?#]/)[0];
    const m = path.match(/profiles\/([^/]+)\/medications\/(add|[^/]+)/);
    if (!m) {
      return { profileId: '', medId: '' };
    }
    const medSeg = m[2];
    return {
      profileId: m[1],
      medId: medSeg === 'add' ? '' : medSeg,
    };
  }

  private resolveMedicationRouteIds(): void {
    const fromTree = { profileId: this.readRouteParam('id'), medId: this.readRouteParam('medId') };
    const fromUrl = this.readMedicationIdsFromUrl();
    this.profileId = fromTree.profileId || fromUrl.profileId;
    this.medId = fromTree.medId || fromUrl.medId;
    this.isAdd = this.router.url.includes('/medications/add');
  }

  private async showHttpError(header: string, e: unknown): Promise<void> {
    console.error(header, e);
    const msg = formatApiError(e);
    const a = await this.alertCtrl.create({ header, message: msg, buttons: ['OK'] });
    await a.present();
  }

  ngOnInit(): void {
    this.resolveMedicationRouteIds();
    if (this.isAdd) {
      this.addStep = 1;
      this.formKind = null;
    }
  }

  async ionViewWillEnter(): Promise<void> {
    this.pageReady = false;
    this.resolveMedicationRouteIds();
    try {
      await this.medData.refresh();
      this.profile = this.medData.getProfile(this.profileId);
      if (!this.isAdd && this.medId) {
        const m = this.medData.getMedicationById(this.medId);
        if (m) {
          this.formName = m.name;
          this.formDosage = m.dosageNote ?? '';
          this.formRemainingQuantity =
            m.remainingQuantity != null ? String(m.remainingQuantity) : '';
          this.formPillsPerIntake = m.pillsPerIntake != null && m.pillsPerIntake >= 1 ? m.pillsPerIntake : 1;
          this.formTimes = m.times.length ? [...m.times] : ['09:00'];
          this.formEnabled = m.enabled;
          this.formKind = m.kind ?? null;
        }
      } else if (this.isAdd) {
        this.formRemainingQuantity = '';
        this.formPillsPerIntake = 1;
      }
    } finally {
      this.pageReady = true;
    }
  }

  backHref(): string {
    return `/tabs/profiles/${this.profileId}`;
  }

  goTypeNext(): void {
    if (this.formKind) {
      this.addStep = 2;
    }
  }

  backToTypeStep(): void {
    this.addStep = 1;
  }

  selectKind(k: MedicationKind): void {
    this.formKind = k;
  }

  backToProfilesList(): void {
    void this.router.navigateByUrl('/tabs/profiles');
  }

  addTimeRow(): void {
    this.formTimes.push('12:00');
  }

  removeTimeRow(index: number): void {
    if (this.formTimes.length <= 1) {
      return;
    }
    this.formTimes.splice(index, 1);
  }

  trackTimeRow(index: number, _item: string): number {
    return index;
  }

  openLearnMore(): void {
    const url = this.medLinks.dailyMedSearchUrl(this.formName);
    if (url) {
      this.medLinks.openUrl(url);
    }
  }

  private parsePillsPerIntake(): number {
    const n = Math.floor(Number(this.formPillsPerIntake)) || 1;
    return Math.max(1, n);
  }

  /** Create: omit stock when blank. */
  private parseRemainingForCreate(): number | undefined {
    const s = this.formRemainingQuantity.trim();
    if (s === '') {
      return undefined;
    }
    return Math.max(0, Math.floor(Number(s)) || 0);
  }

  /** Edit: clear server tracking when blank. */
  private parseRemainingForEdit(): number | null {
    const s = this.formRemainingQuantity.trim();
    if (s === '') {
      return null;
    }
    return Math.max(0, Math.floor(Number(s)) || 0);
  }

  normalizeTime(value: string): string {
    if (!value) {
      return '09:00';
    }
    const segment = value.trim().split(':');
    const h = `${parseInt(segment[0], 10) || 0}`.padStart(2, '0');
    const m = `${parseInt(segment[1] ?? '0', 10) || 0}`.padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * ion-input type="time" may not update ngModel until blur; header Save can read stale values.
   * Sync from the control whenever the user picks a time (also handles HH:mm:ss from WebKit).
   */
  patchTimeFromInput(index: number, ev: Event): void {
    const detail = (ev as CustomEvent<{ value?: string | null }>).detail;
    const raw = detail?.value;
    if (raw === undefined || raw === null) {
      return;
    }
    this.formTimes[index] = this.normalizeTime(String(raw));
  }

  async save(): Promise<void> {
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) {
      ae.blur();
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    this.formTimes = this.formTimes.map((t) => this.normalizeTime(String(t ?? '')));

    const name = this.formName.trim();
    if (!name || !this.profileId) {
      if (!this.profileId) {
        const a = await this.alertCtrl.create({
          header: 'Missing profile',
          message: 'Could not read this screen’s profile id from the route. Go back to Profiles and open Add medication again.',
          buttons: ['OK'],
        });
        await a.present();
      }
      return;
    }
    const times = [...this.formTimes];
    const unique = [...new Set(times)].sort();
    if (unique.length === 0) {
      return;
    }
    if (unique.length !== times.length) {
      const dup = await this.alertCtrl.create({
        header: 'Duplicate times',
        message: 'Two or more reminders use the same time. Change or remove duplicates, then save again.',
        buttons: ['OK'],
      });
      await dup.present();
      return;
    }

    const pillsPerIntake = this.parsePillsPerIntake();
    let existing: Medication | undefined;
    if (!this.isAdd) {
      existing = this.medData.getMedicationById(this.medId);
      if (!existing) {
        await this.showHttpError('Could not save', new Error('Medication not found in app data. Pull to refresh or reopen this screen.'));
        return;
      }
    }

    const loading = await this.loadingCtrl.create({
      message: this.isAdd ? 'Adding medication…' : 'Saving changes…',
    });
    await loading.present();
    try {
      if (this.isAdd) {
        await this.medData.createMedication(this.profileId, {
          name,
          dosageNote: this.formDosage.trim() || undefined,
          times: unique,
          enabled: this.formEnabled,
          remainingQuantity: this.parseRemainingForCreate(),
          pillsPerIntake,
          kind: this.formKind ?? undefined,
        });
      } else if (existing) {
        await this.medData.updateMedication({
          ...existing,
          name,
          dosageNote: this.formDosage.trim() || undefined,
          times: unique,
          enabled: this.formEnabled,
          remainingQuantity: this.parseRemainingForEdit(),
          pillsPerIntake,
          kind: this.formKind ?? undefined,
        });
      }
      await this.medNotif.rescheduleAll();
      await this.router.navigate([this.backHref()]);
    } catch (e: unknown) {
      await this.showHttpError(this.isAdd ? 'Could not add medication' : 'Could not save medication', e);
    } finally {
      await loading.dismiss();
    }
  }

  async deleteMedication(): Promise<void> {
    if (this.isAdd || !this.medId) {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Remove medication?',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Removing medication…' });
            await loading.present();
            try {
              await this.medData.deleteMedication(this.medId);
              await this.medNotif.rescheduleAll();
              await this.router.navigate([this.backHref()]);
            } catch (e: unknown) {
              await this.showHttpError('Could not remove medication', e);
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
