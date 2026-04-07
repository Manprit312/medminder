import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { MedDataService } from '../../services/med-data.service';
import { MedNotificationService } from '../../services/med-notification.service';
import { getApiUrl } from '../../../environments/api-url';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {
  readonly apiUrl = getApiUrl();
  email = '';
  password = '';
  password2 = '';

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
    const loading = await this.loadingCtrl.create({ message: 'Creating account…' });
    await loading.present();
    try {
      await this.auth.register(email, this.password);
      await this.medData.refresh();
      await this.medNotif.initialize();
      await loading.dismiss();
      await this.router.navigateByUrl('/tabs/today', { replaceUrl: true });
    } catch (e: unknown) {
      await loading.dismiss();
      let msg = 'Registration failed';
      if (e instanceof HttpErrorResponse) {
        const body = e.error as { error?: string } | undefined;
        msg = body?.error ?? e.message;
      }
      const alert = await this.alertCtrl.create({
        header: 'Could not register',
        message: msg || 'Try a different email or check the API.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
}
