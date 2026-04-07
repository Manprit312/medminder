import { Injectable } from '@angular/core';
import { CaregiverAlertChannel, CaregiverAlertPayload } from './caregiver-alert-channel';

@Injectable({ providedIn: 'root' })
export class ConsoleCaregiverAlertChannel implements CaregiverAlertChannel {
  readonly id = 'console';

  async notifyMissedDose(payload: CaregiverAlertPayload): Promise<void> {
    console.log(
      '%c[CaregiverAlert]',
      'color:#d97706;font-weight:bold',
      'Missed dose — would notify caregiver',
      payload
    );
  }
}
