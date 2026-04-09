import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ViewWillEnter } from '@ionic/angular';
import { Medication, Profile } from '../../models/med.models';
import { patientContextTips } from '../../shared/patient-context-tips';
import { MedDataService } from '../../services/med-data.service';
import { MedExternalLinksService } from '../../services/med-external-links.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { RefillService } from '../../services/refill.service';

@Component({
  selector: 'app-profile-detail',
  templateUrl: './profile-detail.page.html',
  styleUrls: ['./profile-detail.page.scss'],
  standalone: false,
})
export class ProfileDetailPage implements ViewWillEnter {
  profileId = '';
  profile: Profile | undefined;
  medications: Medication[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly medLinks: MedExternalLinksService,
    private readonly alertCtrl: AlertController,
    readonly refill: RefillService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.profileId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      '';
    await this.medData.refresh();
    this.load();
  }

  load(): void {
    this.profile = this.medData.getProfile(this.profileId);
    this.medications = this.medData.getMedicationsForProfile(this.profileId);
  }

  get patientTipsBlock(): ReturnType<typeof patientContextTips> | null {
    return this.profile ? patientContextTips(this.profile.patientGroup) : null;
  }

  editProfileHref(): string {
    return `/tabs/profiles/${this.profileId}/edit`;
  }

  addMedicationHref(): string {
    return `/tabs/profiles/${this.profileId}/medications/add`;
  }

  editMedicationHref(m: Medication): string {
    return `/tabs/profiles/${this.profileId}/medications/${m.id}`;
  }

  openAddMed(): void {
    void this.router.navigateByUrl(this.addMedicationHref());
  }

  goEditProfile(): void {
    void this.router.navigateByUrl(this.editProfileHref());
  }

  backToFamily(): void {
    void this.router.navigateByUrl('/tabs/profiles');
  }

  openEditMed(m: Medication): void {
    void this.router.navigateByUrl(this.editMedicationHref(m));
  }

  openMedInfo(m: Medication, ev: Event): void {
    ev.stopPropagation();
    const url = this.medLinks.dailyMedSearchUrl(m.name);
    if (url) {
      this.medLinks.openUrl(url);
    }
  }

  async deleteMedication(m: Medication, ev: Event): Promise<void> {
    ev.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Remove medication?',
      message: `Remove “${m.name}” from this profile?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            await this.medData.deleteMedication(m.id);
            await this.medNotif.rescheduleAll();
            this.load();
          },
        },
      ],
    });
    await alert.present();
  }
}
