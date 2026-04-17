import { Component } from '@angular/core';
import { LoadingController, ToastController, ViewWillEnter } from '@ionic/angular';
import { Profile } from '../../models/med.models';
import { CaretakerApiService, EscalationRules, WeeklyDigest } from '../../services/caretaker-api.service';
import { HealthAssistantService } from '../../services/health-assistant.service';
import { MedDataService } from '../../services/med-data.service';

type ChatTurn = { role: 'user' | 'assistant'; text: string };

@Component({
  selector: 'app-health-assistant',
  templateUrl: './health-assistant.page.html',
  styleUrls: ['./health-assistant.page.scss'],
  standalone: false,
})
export class HealthAssistantPage implements ViewWillEnter {
  profiles: Profile[] = [];
  selectedProfileId = '';

  aiEnabled = false;
  strictGuardrails = true;

  digest: WeeklyDigest | null = null;
  escalation: EscalationRules | null = null;
  escalationEnabled = false;
  escalationWindowDays = 3;
  escalationMissedThreshold = 2;

  chatInput = '';
  todayDoses: { status: string; time: string }[] = [];
  chat: ChatTurn[] = [
    {
      role: 'assistant',
      text: 'I can summarize adherence and suggest next actions. I do not diagnose or replace clinician advice.',
    },
  ];

  constructor(
    private readonly medData: MedDataService,
    private readonly assistant: HealthAssistantService,
    private readonly caretakerApi: CaretakerApiService,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.medData.refresh();
    this.profiles = this.medData.getProfilesSnapshot();
    if (!this.selectedProfileId && this.profiles.length > 0) {
      this.selectedProfileId = this.profiles[0].id;
    }
    this.todayDoses = await this.medData.getDosesForDate(new Date().toISOString().slice(0, 10));
    const prefs = await this.assistant.getPrefs();
    this.aiEnabled = prefs.aiEnabled;
    this.strictGuardrails = prefs.strictMedicalGuardrails;
    await this.loadProfileSettings();
  }

  async onProfileChanged(): Promise<void> {
    await this.loadProfileSettings();
  }

  async saveAssistantPrefs(): Promise<void> {
    await this.assistant.savePrefs({
      aiEnabled: this.aiEnabled,
      strictMedicalGuardrails: this.strictGuardrails,
    });
    await this.toast('Assistant preferences saved.', 'success');
  }

  async saveEscalation(): Promise<void> {
    if (!this.selectedProfileId) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Saving escalation rules…' });
    await loading.present();
    try {
      const res = await this.caretakerApi.saveEscalationRules(this.selectedProfileId, {
        enabled: this.escalationEnabled,
        windowDays: this.escalationWindowDays,
        missedThreshold: this.escalationMissedThreshold,
      });
      this.escalation = res;
      await this.toast('Escalation rules updated.', 'success');
    } catch {
      await this.toast('Could not save escalation rules.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async sendWeeklyDigest(): Promise<void> {
    if (!this.selectedProfileId) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Sending weekly digest…' });
    await loading.present();
    try {
      const res = await this.caretakerApi.sendWeeklyDigest(this.selectedProfileId);
      this.digest = res.digest;
      await this.toast(`Weekly digest sent to ${res.sentTo} caretaker(s).`, 'success');
    } catch {
      await this.toast('Could not send weekly digest.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async askAssistant(): Promise<void> {
    const q = this.chatInput.trim();
    if (!q) {
      return;
    }
    this.chatInput = '';
    this.chat = [...this.chat, { role: 'user', text: q }];
    const ctx = {
      taken: this.countToday('taken'),
      pending: this.countToday('pending'),
      missed: this.countToday('missed'),
      nextDose: this.nextDoseTime(),
    };
    const reply = this.assistant.buildAiReply(q, ctx);
    this.chat = [...this.chat, { role: 'assistant', text: reply }];
  }

  private countToday(status: 'taken' | 'pending' | 'missed'): number {
    return this.todayDoses.filter((d) => (status === 'pending' ? d.status === 'pending' : d.status === status))
      .length;
  }

  private nextDoseTime(): string | null {
    const pending = this.todayDoses.filter((d) => d.status === 'pending').sort((a, b) => a.time.localeCompare(b.time));
    if (pending.length === 0) {
      return null;
    }
    const t = pending[0].time;
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  private async loadProfileSettings(): Promise<void> {
    if (!this.selectedProfileId) {
      this.digest = null;
      this.escalation = null;
      return;
    }
    try {
      this.digest = await this.caretakerApi.getWeeklyDigest(this.selectedProfileId);
    } catch {
      this.digest = null;
    }
    try {
      this.escalation = await this.caretakerApi.getEscalationRules(this.selectedProfileId);
      this.escalationEnabled = this.escalation.enabled;
      this.escalationWindowDays = this.escalation.windowDays;
      this.escalationMissedThreshold = this.escalation.missedThreshold;
    } catch {
      this.escalation = null;
      this.escalationEnabled = false;
      this.escalationWindowDays = 3;
      this.escalationMissedThreshold = 2;
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({
      message,
      color,
      duration: 2200,
      position: 'bottom',
    });
    await t.present();
  }
}

