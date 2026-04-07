import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false,
})
export class ForgotPasswordPage {
  email = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  async submit(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!email) {
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Sending…' });
    await loading.present();
    try {
      const res = await this.auth.requestPasswordReset(email);
      await loading.dismiss();
      let message =
        'If that email is registered, check your inbox for a reset link. It expires in one hour.';
      if (res.devResetUrl) {
        message += `\n\n(Dev) Open this link to reset:\n${res.devResetUrl}`;
      }
      const alert = await this.alertCtrl.create({
        header: 'Check your email',
        message,
        buttons: [
          { text: 'OK', handler: () => void this.router.navigateByUrl('/login') },
        ],
      });
      await alert.present();
    } catch (e: unknown) {
      await loading.dismiss();
      let msg = 'Request failed';
      if (e instanceof HttpErrorResponse) {
        const body = e.error as { error?: string } | undefined;
        msg = body?.error ?? e.message;
      }
      const alert = await this.alertCtrl.create({
        header: 'Could not send reset',
        message: msg || 'Check that the API is running and email is configured on the server.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
}
