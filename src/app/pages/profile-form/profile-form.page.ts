import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';

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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    this.isEdit = url.includes('/edit');
    this.profileId =
      this.route.snapshot.paramMap.get('id') ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  async ionViewWillEnter(): Promise<void> {
    await this.medData.refresh();
    if (this.isEdit && this.profileId) {
      const p = this.medData.getProfile(this.profileId);
      if (p) {
        this.name = p.name;
        this.formCaregiverEmail = p.caregiverEmail ?? '';
        this.formCaregiverPhone = p.caregiverPhone ?? '';
      }
    }
  }

  async save(): Promise<void> {
    const n = this.name.trim();
    if (!n) {
      return;
    }
    const caregiver = {
      email: this.formCaregiverEmail.trim(),
      phone: this.formCaregiverPhone.trim(),
    };
    if (this.isEdit && this.profileId) {
      await this.medData.updateProfile(this.profileId, n, caregiver);
      await this.medNotif.rescheduleAll();
      await this.router.navigate(['/tabs/profiles', this.profileId]);
      return;
    }
    const profile = await this.medData.createProfile(n, caregiver);
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
}
