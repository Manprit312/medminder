import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CaretakerAlertsService } from '../../services/caretaker-alerts.service';
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
  phone = '';
  otpCode = '';
  codeSent = false;

  get canSubmitOtp(): boolean {
    return this.otpCode.replace(/\D/g, '').length === 6;
  }

  constructor(
    private readonly auth: AuthService,
    private readonly caretakerAlerts: CaretakerAlertsService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  async sendCode(): Promise<void> {
    const p = this.phone.trim();
    if (!p) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Sending code…' });
    await loading.present();
    try {
      const res = await this.auth.requestOtp(p);
      this.codeSent = true;
      await loading.dismiss();
      if (res.devOtp) {
        const a = await this.alertCtrl.create({
          header: 'Development code',
          message: `Your sign-in code is: ${res.devOtp} (only in dev or when DEV_EXPOSE_OTP is set)`,
          buttons: ['OK'],
        });
        await a.present();
      } else {
        const t = await this.alertCtrl.create({
          header: 'Code sent',
          message: 'Enter the 6-digit code from your SMS.',
          buttons: ['OK'],
        });
        await t.present();
      }
    } catch (e: unknown) {
      await loading.dismiss();
      await this.showErr('Could not send code', e, 'Check the number and try again.');
    }
  }

  async verify(): Promise<void> {
    const p = this.phone.trim();
    const code = this.otpCode.replace(/\D/g, '');
    if (!p || code.length !== 6) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Signing in…' });
    await loading.present();
    try {
      await this.auth.verifyOtp(p, code);
      await this.caretakerAlerts.start();
      await this.medData.refresh();
      await this.medNotif.initialize();
      await loading.dismiss();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const safe =
        returnUrl &&
        returnUrl.startsWith('/') &&
        !returnUrl.startsWith('//') &&
        !returnUrl.includes('://')
          ? returnUrl
          : null;
      await this.router.navigateByUrl(safe ?? '/tabs/today', { replaceUrl: true });
    } catch (e: unknown) {
      await loading.dismiss();
      await this.showErr('Could not sign in', e, 'Check the code and try again.');
    }
  }

  private async showErr(header: string, e: unknown, fallback: string): Promise<void> {
    let msg = fallback;
    if (e instanceof HttpErrorResponse) {
      const body = e.error as { error?: string } | undefined;
      if (e.status === 0) {
        msg =
          'Could not reach the server. Check internet and API URL. If the API was cold-starting, wait a minute and try again.';
      } else {
        msg = body?.error ?? e.message;
      }
    }
    const alert = await this.alertCtrl.create({
      header,
      message: msg || fallback,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
