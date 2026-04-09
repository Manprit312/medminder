import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, ViewWillEnter } from '@ionic/angular';
import { PatientGroup } from '../../models/med.models';
import { PATIENT_GROUP_OPTIONS } from '../../shared/patient-context-tips';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-profile-form',
  templateUrl: './profile-form.page.html',
  styleUrls: ['./profile-form.page.scss'],
  standalone: false,
})
export class ProfileFormPage implements OnInit, ViewWillEnter {
  isEdit = false;
  profileId = '';
  name = '';
  formCaregiverEmail = '';
  formCaregiverPhone = '';
  formPatientGroup: PatientGroup = 'adult';

  readonly patientGroupOptions = PATIENT_GROUP_OPTIONS;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly toastCtrl: ToastController,
    readonly subscription: SubscriptionService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isEdit = url.includes('/edit');
    this.profileId =
      this.route.snapshot.paramMap.get('id') ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  async ionViewWillEnter(): Promise<void> {
    await this.medData.refresh();
    if (!this.isEdit) {
      const n = this.medData.getProfilesSnapshot().length;
      if (!this.subscription.canAddProfile(n)) {
        const t = await this.toastCtrl.create({
          message: 'Multiple family profiles are part of MedMinder Plus.',
          duration: 3500,
          position: 'bottom',
          color: 'dark',
        });
        await t.present();
        await this.router.navigateByUrl('/tabs/profiles', { replaceUrl: true });
        return;
      }
    }
    if (this.isEdit && this.profileId) {
      const p = this.medData.getProfile(this.profileId);
      if (p) {
        this.name = p.name;
        this.formCaregiverEmail = p.caregiverEmail ?? '';
        this.formCaregiverPhone = p.caregiverPhone ?? '';
        this.formPatientGroup = p.patientGroup ?? 'adult';
      }
    }
  }

  async save(): Promise<void> {
    const n = this.name.trim();
    if (!n) {
      return;
    }
    const caregiver = this.caregiverPayloadForSave();
    if (this.isEdit && this.profileId) {
      await this.medData.updateProfile(this.profileId, n, caregiver, this.formPatientGroup);
      await this.medNotif.rescheduleAll();
      await this.router.navigate(['/tabs/profiles', this.profileId]);
      return;
    }
    const profile = await this.medData.createProfile(n, caregiver, this.formPatientGroup);
    await this.medNotif.rescheduleAll();
    await this.router.navigate(['/tabs/profiles', profile.id]);
  }

  cancel(): void {
    if (this.isEdit && this.profileId) {
      void this.router.navigate(['/tabs/profiles', this.profileId]);
    } else {
      void this.router.navigate(['/tabs/profiles']);
    }
  }

  /** Caregiver fields are editable only on Plus; on Free, editing the name must not wipe stored contacts. */
  private caregiverPayloadForSave(): { email: string; phone: string } {
    if (this.subscription.canUseCaregiverFields()) {
      return {
        email: this.formCaregiverEmail.trim(),
        phone: this.formCaregiverPhone.trim(),
      };
    }
    if (this.isEdit && this.profileId) {
      const existing = this.medData.getProfile(this.profileId);
      return {
        email: (existing?.caregiverEmail ?? '').trim(),
        phone: (existing?.caregiverPhone ?? '').trim(),
      };
    }
    return { email: '', phone: '' };
  }

  /** Free tier: show saved caregiver as read-only while editing. */
  get showCaregiverReadonly(): boolean {
    return (
      !this.subscription.canUseCaregiverFields() &&
      this.isEdit &&
      !!(this.formCaregiverEmail?.trim() || this.formCaregiverPhone?.trim())
    );
  }
}
