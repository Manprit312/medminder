import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AlertController, LoadingController, ToastController, ViewWillEnter } from '@ionic/angular';
import { Medication, Profile } from '../../models/med.models';
import { patientContextTips } from '../../shared/patient-context-tips';
import { AgentRecommendation, AiAgentsService } from '../../services/ai-agents.service';
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
  invitePhone = '';
  sendingInvite = false;
  lastInviteLink = '';
  /** Populated after invite is prepared on web — shown as a tappable link. */
  pendingWhatsAppUrl = '';
  recommendedAgents: AgentRecommendation[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly medData: MedDataService,
    private readonly aiAgents: AiAgentsService,
    private readonly medNotif: MedNotificationService,
    private readonly medLinks: MedExternalLinksService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly caretakerApi: CaretakerApiService,
    private readonly toastCtrl: ToastController,
    readonly subscription: SubscriptionService,
    readonly refill: RefillService
  ) {}

  onInvitePhoneChange(): void {
    this.pendingWhatsAppUrl = '';
  }

  async ionViewWillEnter(): Promise<void> {
    this.pageReady = false;
    this.pendingWhatsAppUrl = '';
    this.profileId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      '';
    try {
      await this.medData.refresh();
      this.load();
      await this.loadAgentRecommendations();
    } finally {
      this.pageReady = true;
    }
  }

  load(): void {
    this.profile = this.medData.getProfile(this.profileId);
    this.medications = this.medData.getMedicationsForProfile(this.profileId);
  }

  private async loadAgentRecommendations(): Promise<void> {
    if (!this.profileId) {
      this.recommendedAgents = [];
      return;
    }
    try {
      const res = await this.aiAgents.getRecommendations(this.profileId);
      this.recommendedAgents = res.recommendations.slice(0, 3);
    } catch {
      this.recommendedAgents = [];
    }
  }

  agentPriorityColor(priority: 'low' | 'medium' | 'high'): 'medium' | 'tertiary' | 'primary' {
    if (priority === 'high') {
      return 'primary';
    }
    if (priority === 'medium') {
      return 'tertiary';
    }
    return 'medium';
  }

  agentPriorityLabel(priority: 'low' | 'medium' | 'high'): string {
    if (priority === 'high') {
      return 'Focus now';
    }
    if (priority === 'medium') {
      return 'Helpful next';
    }
    return 'Optional now';
  }

  agentDisplayName(agentId: string): string {
    return agentId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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

  async openAddMed(): Promise<void> {
    if (!this.subscription.canAddMedication(this.medications.length)) {
      const alert = await this.alertCtrl.create({
        header: 'Medication limit reached',
        message: 'Free accounts can track up to 5 medications per profile. Upgrade to MedMinder Plus for unlimited medications.',
        buttons: [
          { text: 'Not now', role: 'cancel' },
          {
            text: 'Upgrade — ₹999',
            handler: () => {
              void this.router.navigateByUrl('/tabs/settings');
            },
          },
        ],
      });
      await alert.present();
      return;
    }
    void this.router.navigateByUrl(this.addMedicationHref());
  }

  goEditProfile(): void {
    void this.router.navigateByUrl(this.editProfileHref());
  }

  backToFamily(): void {
    void this.router.navigateByUrl('/tabs/profiles');
  }

  medTone(index: number): string {
    const tones = ['sage', 'teal', 'taupe', 'terra', 'moss'];
    return tones[index % tones.length];
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

  async shareInviteOnWhatsApp(): Promise<void> {
    const phone = this.invitePhone.trim();
    if (!phone || !this.profileId) {
      await this.simpleToast('Enter caretaker phone first.', 'warning');
      return;
    }
    if (!this.subscription.isPremium) {
      await this.simpleToast('Caretaker invites require MedMinder Plus.', 'warning');
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Preparing WhatsApp invite…' });
    await loading.present();
    try {
      const res = await this.caretakerApi.sendInvite(this.profileId, phone);
      this.lastInviteLink = res.acceptUrl;
      const name = this.profile?.name ?? 'family member';
      const msg = `Hi! I'd like you to be a caretaker for ${name} on MedMinder.\n\nOpen this secure invite link to accept:\n${res.acceptUrl}`;
      const waPhone = phone.replace(/[^\d]/g, '');
      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;

      if (Capacitor.isNativePlatform()) {
        // Native: window.open with _system opens the URL in the device's default browser → WhatsApp
        window.open(waUrl, '_system');
        await this.simpleToast('WhatsApp opened — send the message to complete the invite.', 'success');
      } else {
        // Web: popup blockers fire after async calls — show a tappable link instead
        this.pendingWhatsAppUrl = waUrl;
        await this.simpleToast('Invite ready — tap "Open WhatsApp" below to send it.', 'success');
      }
    } catch {
      await this.simpleToast('Could not prepare WhatsApp invite.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async copyInviteLink(): Promise<void> {
    const phone = this.invitePhone.trim();
    if (!phone || !this.profileId) {
      await this.simpleToast('Enter caretaker phone first.', 'warning');
      return;
    }
    if (!this.subscription.isPremium) {
      await this.simpleToast('Caretaker invites require MedMinder Plus.', 'warning');
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Preparing invite link…' });
    await loading.present();
    try {
      const res = await this.caretakerApi.sendInvite(this.profileId, phone);
      this.lastInviteLink = res.acceptUrl;
      await this.copyText(res.acceptUrl);
      await this.simpleToast('Invite link copied.', 'success');
    } catch {
      await this.simpleToast('Could not copy invite link.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  private async copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  private async simpleToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ): Promise<void> {
    const t = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await t.present();
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
