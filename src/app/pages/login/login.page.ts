import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CaretakerAlertsService } from '../../services/caretaker-alerts.service';
import { FirebaseAuthService } from '../../services/firebase-auth.service';
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

  constructor(
    private readonly auth: AuthService,
    private readonly caretakerAlerts: CaretakerAlertsService,
    private readonly firebaseAuth: FirebaseAuthService,
    private readonly medData: MedDataService,
    private readonly medNotif: MedNotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  async signInWithGoogle(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Connecting Google…' });
    await loading.present();
    try {
      const idToken = await this.firebaseAuth.getGoogleIdToken();
      await this.auth.loginWithGoogleIdToken(idToken);
      await this.finishLogin();
      await loading.dismiss();
    } catch (e: unknown) {
      await loading.dismiss();
      await this.showErr('Google sign-in failed', e, 'Try again in a moment.');
    }
  }

  private async finishLogin(): Promise<void> {
    await this.caretakerAlerts.start();
    await this.medData.refresh();
    await this.medNotif.initialize();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safe =
      returnUrl &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.includes('://')
        ? returnUrl
        : null;
    await this.router.navigateByUrl(safe ?? '/tabs/today', { replaceUrl: true });
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
    } else if (e instanceof Error && e.message.trim()) {
      msg = e.message;
    } else if (typeof e === 'object' && e && 'code' in e) {
      const code = String((e as { code: unknown }).code ?? '').trim();
      const message =
        'message' in e ? String((e as { message: unknown }).message ?? '').trim() : '';
      msg = [code, message].filter(Boolean).join(': ') || fallback;
    }
    const alert = await this.alertCtrl.create({
      header,
      message: msg || fallback,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
