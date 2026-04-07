import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { CaregiverAlertChannel, CaregiverAlertPayload } from './caregiver-alert-channel';

/** In-app simulation of a caregiver alert (toast). Replace/extend with SMS/WhatsApp channels later. */
@Injectable({ providedIn: 'root' })
export class UiCaregiverAlertChannel implements CaregiverAlertChannel {
  readonly id = 'ui';

  constructor(private readonly toastCtrl: ToastController) {}

  async notifyMissedDose(payload: CaregiverAlertPayload): Promise<void> {
    const contact =
      [payload.caregiverEmail, payload.caregiverPhone].filter(Boolean).join(' · ') || 'No caregiver contact set';
    const msg = `Missed dose: ${payload.medicationName} at ${payload.scheduledTime} for ${payload.profileName}. Alert target: ${contact}`;
    const t = await this.toastCtrl.create({
      message: msg,
      duration: 5000,
      position: 'top',
      color: 'warning',
      cssClass: 'caregiver-alert-toast',
    });
    await t.present();
  }
}
