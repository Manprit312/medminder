import { Injectable } from '@angular/core';
import { CaregiverAlertChannel, CaregiverAlertPayload } from './caregiver-alert-channel';
import { ConsoleCaregiverAlertChannel } from './console-caregiver-alert.channel';
import { UiCaregiverAlertChannel } from './ui-caregiver-alert.channel';

/**
 * Orchestrates caregiver notifications for missed doses.
 * To add Twilio SMS or WhatsApp: implement {@link CaregiverAlertChannel}, inject it here, and push into `channels`.
 */
@Injectable({ providedIn: 'root' })
export class CaregiverAlertService {
  private readonly channels: CaregiverAlertChannel[];

  constructor(
    private readonly consoleChannel: ConsoleCaregiverAlertChannel,
    private readonly uiChannel: UiCaregiverAlertChannel
  ) {
    this.channels = [this.consoleChannel, this.uiChannel];
  }

  async notifyMissedDose(payload: CaregiverAlertPayload): Promise<void> {
    await Promise.all(
      this.channels.map((ch) =>
        ch.notifyMissedDose(payload).catch((err) => console.error(`CaregiverAlertChannel(${ch.id})`, err))
      )
    );
  }
}
