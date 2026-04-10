import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { ToastController } from '@ionic/angular';
import { MedDataService } from './med-data.service';

const ACTION_TYPE_ID = 'MED_DOSE_V1';
const ACTION_TAKEN = 'TAKEN';
const ACTION_MISSED = 'MISSED';
/** Content tap (iOS UNNotificationDefaultActionIdentifier + Android default intent). */
const ACTION_TAP = 'tap';

/** Fixed id for one-shot “test reminder” (avoids colliding with stableNotificationId hashes). */
const TEST_NOTIFICATION_ID = 2_147_482_000;

export interface MedNotificationExtra {
  medicationId: string;
  scheduledTime: string;
  medName: string;
  profileName: string;
}

/** Deterministic 32-bit id for (medicationId, time) — fits Android notification id range. */
export function stableNotificationId(medicationId: string, time: string): number {
  const s = `${medicationId}|${time}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = Math.abs(h) % 2147483646;
  return n === 0 ? 1 : n;
}

function parseTime(t: string): { hour: number; minute: number } | null {
  const s = t.trim();
  if (!s) {
    return null;
  }
  const parts = s.split(':');
  if (parts.length < 2) {
    return null;
  }
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return { hour: h, minute: m };
}

function encodeTimeTokenForDoseRoute(scheduledTime: string): string {
  return scheduledTime.trim().replace(/:/g, '-');
}

/**
 * Capacitor Local Notifications: schedule, cancel, action buttons (Taken / Missed),
 * foreground + resume handling, deduped logging.
 */
@Injectable({ providedIn: 'root' })
export class MedicationReminderNotificationsService {
  private listenersBound = false;
  private resumeDebounce: ReturnType<typeof setTimeout> | null = null;
  private lastActionAt = new Map<string, number>();

  constructor(
    private readonly medData: MedDataService,
    private readonly ngZone: NgZone,
    private readonly router: Router,
    private readonly toastCtrl: ToastController
  ) {}

  /** Wire listeners once (app shell). */
  async initializeListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.listenersBound) {
      return;
    }
    this.listenersBound = true;

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_ID,
          actions: [
            { id: ACTION_TAKEN, title: 'Taken', foreground: true },
            { id: ACTION_MISSED, title: 'Missed', foreground: true, destructive: true },
          ],
        },
      ],
    });

    await LocalNotifications.addListener('localNotificationReceived', (notification) => {
      this.ngZone.run(() => {
        void this.onNotificationDisplayed(notification);
      });
    });

    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      this.ngZone.run(() => {
        void this.onAction(event.actionId, event.notification);
      });
    });

    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.scheduleResumeRefresh();
      }
    });
  }

  private scheduleResumeRefresh(): void {
    if (this.resumeDebounce) {
      clearTimeout(this.resumeDebounce);
    }
    this.resumeDebounce = setTimeout(() => {
      this.resumeDebounce = null;
      void this.rescheduleAll();
    }, 600);
  }

  private async onNotificationDisplayed(notification: LocalNotificationSchema): Promise<void> {
    const extra = notification.extra as MedNotificationExtra | undefined;
    if (!extra?.medicationId) {
      return;
    }
    await this.medData.refresh();
  }

  private navigateToDoseLog(extra: MedNotificationExtra): void {
    const token = encodeTimeTokenForDoseRoute(extra.scheduledTime);
    void this.router.navigateByUrl(`/tabs/today/dose/${extra.medicationId}/${token}`);
  }

  private async onAction(actionId: string, notification: LocalNotificationSchema): Promise<void> {
    const extra = notification.extra as MedNotificationExtra | undefined;

    if (actionId === ACTION_TAP) {
      if (!extra?.medicationId || !extra.scheduledTime) {
        return;
      }
      const key = `tap|${extra.medicationId}|${extra.scheduledTime}`;
      const now = Date.now();
      const prev = this.lastActionAt.get(key) ?? 0;
      if (now - prev < 4000) {
        return;
      }
      this.lastActionAt.set(key, now);
      try {
        await this.medData.refresh();
      } catch {
        /* still open dose screen; it refreshes on enter */
      }
      this.navigateToDoseLog(extra);
      return;
    }

    if (actionId !== ACTION_TAKEN && actionId !== ACTION_MISSED) {
      return;
    }
    if (!extra?.medicationId || !extra.scheduledTime) {
      return;
    }
    const key = `${extra.medicationId}|${extra.scheduledTime}|${actionId}`;
    const now = Date.now();
    const prev = this.lastActionAt.get(key) ?? 0;
    if (now - prev < 4000) {
      return;
    }
    this.lastActionAt.set(key, now);

    const status = actionId === ACTION_TAKEN ? 'taken' : 'missed';
    try {
      await this.medData.logDose(extra.medicationId, extra.scheduledTime, status);
      const t = await this.toastCtrl.create({
        message: status === 'taken' ? 'Marked as taken' : 'Marked as missed',
        duration: 2000,
        position: 'bottom',
        color: status === 'taken' ? 'success' : 'warning',
      });
      await t.present();
      this.navigateToDoseLog(extra);
    } catch (e) {
      console.error('Notification action log failed', e);
      const t = await this.toastCtrl.create({
        message: 'Could not update dose log',
        duration: 2500,
        color: 'danger',
      });
      await t.present();
    }
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      await LocalNotifications.createChannel({
        id: 'medminder',
        name: 'Medication reminders',
        description: 'Daily medication reminders',
        importance: 4,
        visibility: 1,
      });
    } catch {
      /* channel may exist */
    }
  }

  /**
   * Clear every pending local notification (e.g. logout). Does not require display permission
   * so alarms are still removed when the user previously denied banners.
   */
  async cancelAllPendingLocalNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length === 0) {
      return;
    }
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  /** Cancel all pending local notifications we manage, then reschedule from current meds. */
  async rescheduleAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.ensureAndroidChannel();

    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') {
      return;
    }

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    const profiles = this.medData.getProfilesSnapshot();
    const profileNames = new Map(profiles.map((p) => [p.id, p.name]));
    const meds = this.medData.getMedicationsSnapshot().filter((m) => m.enabled);

    const notifications: LocalNotificationSchema[] = [];

    for (const m of meds) {
      const pname = profileNames.get(m.profileId) ?? 'Someone';
      for (const t of m.times) {
        const timeKey = t.trim();
        const parsed = parseTime(timeKey);
        if (!parsed) {
          continue;
        }
        const { hour, minute } = parsed;
        const extra: MedNotificationExtra = {
          medicationId: m.id,
          scheduledTime: timeKey,
          medName: m.name,
          profileName: pname,
        };
        // Daily wall-clock time: use `on` + `repeats` only.
        // IMPORTANT (Android): The native plugin evaluates `every` before `on`. If both are set,
        // it uses setRepeating(interval) from *now* and never applies hour/minute — reminders won't
        // fire at dose times. iOS evaluates `on` first; omitting `every` is correct on both.
        const n: LocalNotificationSchema = {
          id: stableNotificationId(m.id, timeKey),
          title: 'Medication reminder',
          body: `${m.name} — ${pname} · ${timeKey}`,
          actionTypeId: ACTION_TYPE_ID,
          extra,
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
        };
        if (Capacitor.getPlatform() === 'android') {
          n.channelId = 'medminder';
        }
        notifications.push(n);
      }
    }

    if (notifications.length === 0) {
      return;
    }

    try {
      await LocalNotifications.schedule({ notifications });
    } catch (e) {
      console.error('[MedMinder] LocalNotifications.schedule failed', e);
    }
  }

  async requestPermissionAndSchedule(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    await this.ensureAndroidChannel();
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== 'granted') {
      return false;
    }
    await this.rescheduleAll();
    return true;
  }

  /**
   * Ask for notification permission if needed, then reschedule. Android 13+ often stays on
   * `prompt` until requestPermissions() runs — checking alone never schedules reminders.
   */
  async initializeScheduling(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.ensureAndroidChannel();
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display === 'granted') {
      await this.rescheduleAll();
    }
  }

  /**
   * Schedule a single local notification in `seconds` (for learning / QA).
   * Does not use Firebase — same {@link LocalNotifications} API as real dose reminders.
   */
  async scheduleTestNotificationIn(seconds: number): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    const sec = Math.max(5, Math.min(120, Math.floor(seconds)));
    await this.ensureAndroidChannel();
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      return false;
    }
    const at = new Date(Date.now() + sec * 1000);
    const n: LocalNotificationSchema = {
      id: TEST_NOTIFICATION_ID,
      title: 'MedMinder test',
      body: `This is a local notification. Fires at ${at.toLocaleTimeString()}.`,
      schedule: { at, allowWhileIdle: true },
    };
    if (Capacitor.getPlatform() === 'android') {
      n.channelId = 'medminder';
    }
    await LocalNotifications.schedule({ notifications: [n] });
    return true;
  }
}
