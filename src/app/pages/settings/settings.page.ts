import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { LoadingController, ToastController, ViewWillEnter } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CaretakerAlertsService } from '../../services/caretaker-alerts.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements ViewWillEnter {
  native = Capacitor.isNativePlatform();
  permDisplay: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly caretakerAlerts: CaretakerAlertsService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly loadingCtrl: LoadingController,
    readonly subscription: SubscriptionService
  ) {}

  get email(): string | null {
    return this.auth.getEmail();
  }

  ionViewWillEnter(): void {
    void this.refreshPerm();
    void this.subscription.refreshFromApi();
  }

  /** Staging/dev only — server returns 403 when billing simulation is disabled. */
  async simulatePlus(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Updating plan…' });
    await loading.present();
    try {
      await this.subscription.simulateTier('premium');
      const t = await this.toastCtrl.create({
        message: 'Plan set to Plus (simulation).',
        duration: 2500,
        color: 'success',
        position: 'bottom',
      });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({
        message: 'Could not change plan (simulation may be disabled on this server).',
        duration: 3500,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      await loading.dismiss();
    }
  }

  async simulateFree(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Updating plan…' });
    await loading.present();
    try {
      await this.subscription.simulateTier('free');
      const t = await this.toastCtrl.create({
        message: 'Plan set to Free (simulation).',
        duration: 2500,
        color: 'medium',
        position: 'bottom',
      });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({
        message: 'Could not change plan.',
        duration: 3500,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      await loading.dismiss();
    }
  }

  private async refreshPerm(): Promise<void> {
    if (this.native) {
      const p = await LocalNotifications.checkPermissions();
      this.permDisplay = p.display;
    }
  }

  async requestNotifications(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Enabling reminders…' });
    await loading.present();
    try {
      await this.medNotif.requestPermissionAndSchedule();
      await this.refreshPerm();
    } finally {
      await loading.dismiss();
    }
  }

  /** Quick sanity check: local notification in ~10s (not push / not Firebase). */
  async sendTestReminder(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Scheduling test…' });
    await loading.present();
    let ok = false;
    try {
      ok = await this.medNotif.scheduleTestNotificationIn(10);
    } finally {
      await loading.dismiss();
    }
    const t = await this.toastCtrl.create({
      message: ok
        ? 'Test reminder in about 10 seconds. You can leave the app.'
        : 'Allow notifications first (Enable reminders), then try again.',
      duration: 3500,
      position: 'bottom',
      color: ok ? 'success' : 'warning',
    });
    await t.present();
    await this.refreshPerm();
  }

  async logout(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Signing out…' });
    await loading.present();
    try {
      await this.auth.logout();
      this.caretakerAlerts.stop();
      this.medData.clear();
      await this.medNotif.cancelAllPendingLocalNotifications();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } finally {
      await loading.dismiss();
    }
  }
}
