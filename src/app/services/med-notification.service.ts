import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { MedicationReminderNotificationsService } from './medication-reminder-notifications.service';

/**
 * Facade for medication reminders — delegates to {@link MedicationReminderNotificationsService}.
 */
@Injectable({ providedIn: 'root' })
export class MedNotificationService {
  constructor(private readonly reminders: MedicationReminderNotificationsService) {}

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.reminders.initializeListeners();
    await this.reminders.initializeScheduling();
  }

  async requestPermissionAndSchedule(): Promise<boolean> {
    return this.reminders.requestPermissionAndSchedule();
  }

  async rescheduleAll(): Promise<void> {
    return this.reminders.rescheduleAll();
  }
}
