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

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 };
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

  private async onAction(actionId: string, notification: LocalNotificationSchema): Promise<void> {
    if (actionId !== ACTION_TAKEN && actionId !== ACTION_MISSED) {
      return;
    }
    const extra = notification.extra as MedNotificationExtra | undefined;
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
      await this.router.navigate(['/tabs/today'], { replaceUrl: false });
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

  /** Cancel all pending local notifications we manage, then reschedule from current meds. */
  async rescheduleAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.ensureAndroidChannel();

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
        const { hour, minute } = parseTime(t);
        const extra: MedNotificationExtra = {
          medicationId: m.id,
          scheduledTime: t,
          medName: m.name,
          profileName: pname,
        };
        const n: LocalNotificationSchema = {
          id: stableNotificationId(m.id, t),
          title: 'Medication reminder',
          body: `${m.name} — ${pname} · ${t}`,
          actionTypeId: ACTION_TYPE_ID,
          extra,
          schedule: {
            on: { hour, minute },
            repeats: true,
            every: 'day',
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

    await LocalNotifications.schedule({ notifications });
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

  /** After permission granted on cold start. */
  async initializeScheduling(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await this.ensureAndroidChannel();
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') {
      await this.rescheduleAll();
    }
  }
}
