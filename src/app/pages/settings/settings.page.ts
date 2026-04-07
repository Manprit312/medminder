import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ViewWillEnter } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { getApiUrl } from '../../../environments/api-url';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements ViewWillEnter {
  readonly apiUrl = getApiUrl();
  native = Capacitor.isNativePlatform();
  permDisplay: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router
  ) {}

  get email(): string | null {
    return this.auth.getEmail();
  }

  ionViewWillEnter(): void {
    void this.refreshPerm();
  }

  private async refreshPerm(): Promise<void> {
    if (this.native) {
      const p = await LocalNotifications.checkPermissions();
      this.permDisplay = p.display;
    }
  }

  async requestNotifications(): Promise<void> {
    await this.medNotif.requestPermissionAndSchedule();
    await this.refreshPerm();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.medData.clear();
    await this.medNotif.rescheduleAll();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
