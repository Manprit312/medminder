import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from '../../../environments/api-url';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlertController, LoadingController, ToastController, ViewWillEnter } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CaretakerAlertsService } from '../../services/caretaker-alerts.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { SubscriptionService } from '../../services/subscription.service';
import { UserDataService } from '../../services/user-data.service';

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
    private readonly alertCtrl: AlertController,
    private readonly userData: UserDataService,
    readonly subscription: SubscriptionService
  ) {}

  get userDisplay(): string | null {
    return this.auth.getUserDisplay();
  }

  /** Friendly copy for Settings → Reminders (avoids raw API values like `prompt`). */
  get reminderPermissionHint(): string {
    switch (this.permDisplay) {
      case 'granted':
        return 'On — we will remind you at each scheduled dose time.';
      case 'denied':
        return 'Off — enable alerts in system Settings to receive dose reminders.';
      case 'prompt':
        return 'Not enabled yet — tap Allow dose reminders below.';
      default:
        return this.permDisplay ? String(this.permDisplay) : 'Checking…';
    }
  }

  ionViewWillEnter(): void {
    void this.refreshPerm();
    void this.subscription.refreshFromApi();
  }

  async buyLifetime(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Opening payment…' });
    await loading.present();
    try {
      const display = this.auth.getUserDisplay();
      await this.subscription.buyLifetime({ name: display ?? undefined });
      const t = await this.toastCtrl.create({
        message: 'Welcome to MedMinder Plus! All features are now unlocked.',
        duration: 3500,
        color: 'success',
        position: 'bottom',
      });
      await t.present();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment could not be completed.';
      if (msg === 'Payment cancelled.') {
        return;
      }
      const t = await this.toastCtrl.create({
        message: msg,
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
    const loading = await this.loadingCtrl.create({ message: 'Turning on reminders…' });
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
        ? 'You should get a test alert in about 10 seconds. You can leave the app.'
        : 'Allow notifications first (Allow dose reminders), then try again.',
      duration: 3500,
      position: 'bottom',
      color: ok ? 'success' : 'warning',
    });
    await t.present();
    await this.refreshPerm();
  }

  openPrivacyPolicy(): void {
    const url = `${getApiUrl()}/privacy`;
    if (Capacitor.isNativePlatform()) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  async openMedicalReport(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Building report…' });
    await loading.present();
    try {
      await this.userData.openMedicalReport();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate report. Try again.';
      const t = await this.toastCtrl.create({
        message: msg,
        duration: 4000,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      await loading.dismiss();
    }
  }

  async exportData(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Preparing export…' });
    await loading.present();
    try {
      await this.userData.downloadJsonExport();
      const t = await this.toastCtrl.create({
        message: 'Your data has been downloaded as a JSON file.',
        duration: 3000,
        color: 'success',
        position: 'bottom',
      });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({
        message: 'Could not export data. Try again.',
        duration: 3000,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      await loading.dismiss();
    }
  }

  async confirmDeleteAccount(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete account?',
      message:
        'This permanently deletes your account, all profiles, medications, and dose history. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete everything',
          role: 'destructive',
          handler: () => {
            void this.deleteAccount();
          },
        },
      ],
    });
    await alert.present();
  }

  private async deleteAccount(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Deleting account…' });
    await loading.present();
    try {
      await this.userData.deleteAccount();
      await this.auth.logout();
      this.caretakerAlerts.stop();
      this.medData.clear();
      await this.medNotif.cancelAllPendingLocalNotifications();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      const t = await this.toastCtrl.create({
        message: 'Your account and data have been permanently deleted.',
        duration: 4000,
        color: 'medium',
        position: 'bottom',
      });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({
        message: 'Could not delete account. Try again.',
        duration: 3000,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      await loading.dismiss();
    }
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
