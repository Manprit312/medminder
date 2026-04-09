import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ViewWillEnter } from '@ionic/angular';
import { Medication, MedicationKind, Profile } from '../../models/med.models';
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
    private readonly alertCtrl: AlertController
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

  private async showHttpError(header: string, e: unknown): Promise<void> {
    let msg = 'Request failed';
    if (e instanceof HttpErrorResponse) {
      const body = e.error as { error?: string } | undefined;
      msg = body?.error ?? e.message;
    } else if (e instanceof Error) {
      msg = e.message;
    }
    const a = await this.alertCtrl.create({ header, message: msg, buttons: ['OK'] });
    await a.present();
  }

  ngOnInit(): void {
    this.profileId = this.readRouteParam('id');
    this.medId = this.readRouteParam('medId');
    this.isAdd = this.router.url.includes('/medications/add');
    if (this.isAdd) {
      this.addStep = 1;
      this.formKind = null;
    }
  }

  ionViewWillEnter(): void {
    this.profileId = this.readRouteParam('id');
    this.medId = this.readRouteParam('medId');
    void this.medData.refresh().then(() => {
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
    });
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
    const parts = value.split(':');
    const h = `${parseInt(parts[0], 10) || 0}`.padStart(2, '0');
    const m = `${parseInt(parts[1] ?? '0', 10) || 0}`.padStart(2, '0');
    return `${h}:${m}`;
  }

  async save(): Promise<void> {
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
    const times = this.formTimes.map((t) => this.normalizeTime(t));
    const unique = [...new Set(times)].sort();
    if (unique.length === 0) {
      return;
    }

    const pillsPerIntake = this.parsePillsPerIntake();
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
      } else {
        const existing = this.medData.getMedicationById(this.medId);
        if (!existing) {
          await this.showHttpError('Could not save', new Error('Medication not found in app data. Pull to refresh or reopen this screen.'));
          return;
        }
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
            try {
              await this.medData.deleteMedication(this.medId);
              await this.medNotif.rescheduleAll();
              await this.router.navigate([this.backHref()]);
            } catch (e: unknown) {
              await this.showHttpError('Could not remove medication', e);
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
