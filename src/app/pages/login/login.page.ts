import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { getApiUrl } from '../../../environments/api-url';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  readonly apiUrl = getApiUrl();
  email = '';
  password = '';

  constructor(
    private readonly auth: AuthService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  async submit(): Promise<void> {
    const email = this.email.trim();
    if (!email || !this.password) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Signing in…' });
    await loading.present();
    try {
      await this.auth.login(email, this.password);
      await this.medData.refresh();
      await this.medNotif.initialize();
      await loading.dismiss();
      await this.router.navigateByUrl('/tabs/today', { replaceUrl: true });
    } catch (e: unknown) {
      await loading.dismiss();
      let msg = 'Sign-in failed';
      if (e instanceof HttpErrorResponse) {
        const body = e.error as { error?: string } | undefined;
        msg = body?.error ?? e.message;
      }
      const alert = await this.alertCtrl.create({
        header: 'Could not sign in',
        message: msg || 'Check email, password, and that the API is running.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
}
