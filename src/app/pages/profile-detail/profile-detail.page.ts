import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  inviteEmail = '';
  sendingInvite = false;
  lastInviteLink = '';
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

  async ionViewWillEnter(): Promise<void> {
    this.pageReady = false;
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

  async shareInviteOnWhatsApp(): Promise<void> {
    const email = this.inviteEmail.trim().toLowerCase();
    if (!email || !this.profileId) {
      await this.simpleToast('Enter caretaker email first.', 'warning');
      return;
    }
    if (!this.subscription.isPremium) {
      await this.simpleToast('Caretaker invites require MedMinder Plus.', 'warning');
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Preparing WhatsApp invite…' });
    await loading.present();
    try {
      const res = await this.caretakerApi.sendInvite(this.profileId, email);
      this.lastInviteLink = res.acceptUrl;
      const name = this.profile?.name ?? 'family member';
      const msg = `Hi, I invited you to follow ${name} on MedMinder. Open this secure invite link: ${res.acceptUrl}`;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_system');
      await this.simpleToast('WhatsApp invite opened.', 'success');
    } catch {
      await this.simpleToast('Could not prepare WhatsApp invite.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async copyInviteLink(): Promise<void> {
    const email = this.inviteEmail.trim().toLowerCase();
    if (!email || !this.profileId) {
      await this.simpleToast('Enter caretaker email first.', 'warning');
      return;
    }
    if (!this.subscription.isPremium) {
      await this.simpleToast('Caretaker invites require MedMinder Plus.', 'warning');
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Preparing invite link…' });
    await loading.present();
    try {
      const res = await this.caretakerApi.sendInvite(this.profileId, email);
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
