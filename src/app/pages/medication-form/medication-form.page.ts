import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ViewWillEnter } from '@ionic/angular';
import { Medication, Profile } from '../../models/med.models';
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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly medLinks: MedExternalLinksService,
    private readonly alertCtrl: AlertController
  ) {}

  ngOnInit(): void {
    this.profileId =
      this.route.snapshot.paramMap.get('id') ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.medId = this.route.snapshot.paramMap.get('medId') ?? '';
    this.isAdd = this.router.url.includes('/medications/add');
  }

  ionViewWillEnter(): void {
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
      return;
    }
    const times = this.formTimes.map((t) => this.normalizeTime(t));
    const unique = [...new Set(times)].sort();
    if (unique.length === 0) {
      return;
    }

    const pillsPerIntake = this.parsePillsPerIntake();
    if (this.isAdd) {
      await this.medData.createMedication(this.profileId, {
        name,
        dosageNote: this.formDosage.trim() || undefined,
        times: unique,
        enabled: this.formEnabled,
        remainingQuantity: this.parseRemainingForCreate(),
        pillsPerIntake,
      });
    } else {
      const existing = this.medData.getMedicationById(this.medId);
      if (!existing) {
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
      });
    }
    await this.medNotif.rescheduleAll();
    await this.router.navigate([this.backHref()]);
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
            await this.medData.deleteMedication(this.medId);
            await this.medNotif.rescheduleAll();
            await this.router.navigate([this.backHref()]);
          },
        },
      ],
    });
    await alert.present();
  }
}
