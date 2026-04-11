import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController, ViewWillEnter } from '@ionic/angular';
import { Medication, Profile } from '../../models/med.models';
import { patientContextTips } from '../../shared/patient-context-tips';
import { MedDataService } from '../../services/med-data.service';
import { MedExternalLinksService } from '../../services/med-external-links.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { RefillService } from '../../services/refill.service';
import { CaretakerApiService } from '../../services/caretaker-api.service';
import { SubscriptionService } from '../../services/subscription.service';

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
  /** False until the first `refresh()` for this visit finishes — avoids a false “Profile not found” while the API is slow. */
  pageReady = false;
  inviteEmail = '';
  sendingInvite = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly medLinks: MedExternalLinksService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly caretakerApi: CaretakerApiService,
    private readonly toastCtrl: ToastController,
    readonly subscription: SubscriptionService,
    readonly refill: RefillService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.pageReady = false;
    this.profileId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      '';
    try {
      await this.medData.refresh();
      this.load();
    } finally {
      this.pageReady = true;
    }
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

  async sendCaretakerInvite(): Promise<void> {
    const email = this.inviteEmail.trim().toLowerCase();
    if (!email || !this.profileId) {
      return;
    }
    if (!this.subscription.isPremium) {
      const t = await this.toastCtrl.create({
        message: 'Caretaker invites require MedMinder Plus.',
        duration: 3000,
        color: 'warning',
        position: 'bottom',
      });
      await t.present();
      return;
    }
    this.sendingInvite = true;
    try {
      const res = await this.caretakerApi.sendInvite(this.profileId, email);
      const msg = res.invite.emailed
        ? `Invite email sent to ${email}.`
        : `Invite saved. Email was not sent — use the link below or fix mail on the server.`;
      const detail = res.mailHint ? ` ${res.mailHint}` : '';
      const linkPart = res.acceptUrl ? ` Link: ${res.acceptUrl}` : '';
      const t = await this.toastCtrl.create({
        message: `${msg}${detail}${linkPart}`,
        duration: res.acceptUrl || res.mailHint ? 14000 : 3500,
        color: 'success',
        position: 'bottom',
      });
      await t.present();
      this.inviteEmail = '';
    } catch {
      const t = await this.toastCtrl.create({
        message: 'Could not send invite. Check Plus plan, email format, and API.',
        duration: 4000,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      this.sendingInvite = false;
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
            const loading = await this.loadingCtrl.create({ message: 'Removing medication…' });
            await loading.present();
            try {
              await this.medData.deleteMedication(m.id);
              await this.medNotif.rescheduleAll();
              this.load();
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
