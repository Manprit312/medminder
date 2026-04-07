import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: false,
})
export class ResetPasswordPage implements OnInit {
  token = '';
  password = '';
  password2 = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
  }

  async submit(): Promise<void> {
    const t = this.token.trim();
    if (!t) {
      const a = await this.alertCtrl.create({
        header: 'Missing link',
        message: 'Open the reset link from your email, or paste the token below.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }
    if (this.password.length < 8) {
      const a = await this.alertCtrl.create({
        header: 'Password too short',
        message: 'Use at least 8 characters.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }
    if (this.password !== this.password2) {
      const a = await this.alertCtrl.create({
        header: 'Mismatch',
        message: 'Passwords do not match.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Updating password…' });
    await loading.present();
    try {
      await this.auth.resetPassword(t, this.password);
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: 'Password updated',
        message: 'You can sign in with your new password.',
        buttons: [{ text: 'OK', handler: () => void this.router.navigateByUrl('/login') }],
      });
      await alert.present();
    } catch (e: unknown) {
      await loading.dismiss();
      let msg = 'Reset failed';
      if (e instanceof HttpErrorResponse) {
        const body = e.error as { error?: string } | undefined;
        msg = body?.error ?? e.message;
      }
      const alert = await this.alertCtrl.create({
        header: 'Could not reset',
        message: msg || 'The link may have expired. Request a new one from Forgot password.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
}
