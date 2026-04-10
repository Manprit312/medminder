import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { MedicationReminderNotificationsService } from './medication-reminder-notifications.service';

/**
 * Facade for medication reminders — delegates to {@link MedicationReminderNotificationsService}.
 */
@Injectable({ providedIn: 'root' })
export class MedNotificationService {
  constructor(private readonly reminders: MedicationReminderNotificationsService) {}

  /** Action buttons + OS listeners; safe before med data is loaded. */
  async registerNotificationListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.reminders.initializeListeners();
  }

  /** Re-read meds and reschedule if notification permission is granted. */
  async syncScheduleFromMedications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.reminders.initializeScheduling();
  }

  async initialize(): Promise<void> {
    await this.registerNotificationListeners();
    await this.syncScheduleFromMedications();
  }

  async requestPermissionAndSchedule(): Promise<boolean> {
    return this.reminders.requestPermissionAndSchedule();
  }

  async rescheduleAll(): Promise<void> {
    return this.reminders.rescheduleAll();
  }

  /** Clear all pending local notifications (e.g. after logout). */
  async cancelAllPendingLocalNotifications(): Promise<void> {
    return this.reminders.cancelAllPendingLocalNotifications();
  }

  /** One-shot test notification on device (see Settings). */
  async scheduleTestNotificationIn(seconds: number): Promise<boolean> {
    return this.reminders.scheduleTestNotificationIn(seconds);
  }
}
