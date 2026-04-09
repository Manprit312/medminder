import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController, ViewWillEnter } from '@ionic/angular';
import { Profile } from '../../models/med.models';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { SubscriptionService } from '../../services/subscription.service';

const AVATAR_COLORS = [
  'var(--ion-color-primary)',
  'var(--ion-color-secondary)',
  'var(--ion-color-tertiary)',
  'var(--ion-color-success)',
  'var(--ion-color-warning)',
  'var(--ion-color-danger)',
];

@Component({
  selector: 'app-profiles',
  templateUrl: './profiles.page.html',
  styleUrls: ['./profiles.page.scss'],
  standalone: false,
})
export class ProfilesPage implements ViewWillEnter {
  profiles: Profile[] = [];
  avatarColors = AVATAR_COLORS;

  constructor(
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
    readonly subscription: SubscriptionService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.medData.refresh();
    this.profiles = this.medData.getProfilesSnapshot();
  }

  avatarColor(index: number): string {
    return this.avatarColors[index % this.avatarColors.length];
  }

  openProfile(p: Profile): void {
    void this.router.navigate(['/tabs/profiles', p.id]);
  }

  editProfile(p: Profile, ev: Event): void {
    ev.stopPropagation();
    void this.router.navigate(['/tabs/profiles', p.id, 'edit']);
  }

  async deleteProfile(p: Profile, ev: Event): Promise<void> {
    ev.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Remove profile?',
      message: `This removes “${p.name}” and all medications for this person.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            await this.medData.deleteProfile(p.id);
            await this.medNotif.rescheduleAll();
            this.profiles = this.medData.getProfilesSnapshot();
          },
        },
      ],
    });
    await alert.present();
  }

  medCount(profileId: string): number {
    return this.medData.getMedicationsForProfile(profileId).length;
  }

  /** RouterLink on ion-button / ion-fab-button is unreliable; use programmatic navigation. */
  async goAddProfile(): Promise<void> {
    const n = this.profiles.length;
    if (!this.subscription.canAddProfile(n)) {
      const t = await this.toastCtrl.create({
        message: 'More than one profile is available with MedMinder Plus.',
        duration: 3200,
        position: 'bottom',
        color: 'dark',
      });
      await t.present();
      return;
    }
    await this.router.navigateByUrl('/tabs/profiles/add');
  }
}
