import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { OnboardingAudience, OnboardingService } from '../../services/onboarding.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage {
  step = 1;
  readonly totalSteps = 5;

  audience: OnboardingAudience | null = null;

  profileName = '';
  private profileId = '';

  medName = '';
  medTime = '09:00';

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  progress(): number {
    return this.step / this.totalSteps;
  }

  nextFromWelcome(): void {
    this.step = 2;
  }

  async nextFromAudience(): Promise<void> {
    if (!this.audience) {
      const a = await this.alertCtrl.create({
        header: 'Choose one',
        message: 'Select who you are tracking medicines for.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }
    await this.onboarding.setAudience(this.audience);
    this.step = 3;
  }

  async nextFromProfile(): Promise<void> {
    const name = this.profileName.trim();
    if (!name) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Saving…' });
    await loading.present();
    try {
      const p = await this.medData.createProfile(name);
      this.profileId = p.id;
      await loading.dismiss();
      this.step = 4;
    } catch (e: unknown) {
      await loading.dismiss();
      await this.showHttpError('Could not add profile', e);
    }
  }

  async finishMedication(): Promise<void> {
    const med = this.medName.trim();
    if (!med || !this.profileId) {
      return;
    }
    const times = [this.normalizeTime(this.medTime)];
    const loading = await this.loadingCtrl.create({ message: 'Saving…' });
    await loading.present();
    try {
      await this.medData.createMedication(this.profileId, {
        name: med,
        times,
        enabled: true,
      });
      await this.medNotif.rescheduleAll();
      await this.onboarding.setComplete();
      await loading.dismiss();
      this.step = 5;
    } catch (e: unknown) {
      await loading.dismiss();
      await this.showHttpError('Could not add medication', e);
    }
  }

  async goToToday(): Promise<void> {
    await this.router.navigateByUrl('/tabs/today', { replaceUrl: true });
  }

  private normalizeTime(value: string): string {
    if (!value) {
      return '09:00';
    }
    const parts = value.split(':');
    const h = `${parseInt(parts[0], 10) || 0}`.padStart(2, '0');
    const m = `${parseInt(parts[1] ?? '0', 10) || 0}`.padStart(2, '0');
    return `${h}:${m}`;
  }

  private async showHttpError(header: string, e: unknown): Promise<void> {
    let msg = 'Request failed';
    if (e instanceof HttpErrorResponse) {
      const body = e.error as { error?: string } | undefined;
      msg = body?.error ?? e.message;
    }
    const a = await this.alertCtrl.create({ header, message: msg, buttons: ['OK'] });
    await a.present();
  }
}
