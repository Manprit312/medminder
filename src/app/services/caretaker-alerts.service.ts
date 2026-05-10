import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import {
  MM_ANDROID_CHANNEL_CARETAKER,
  MM_NOTIF_CARETAKER_ACCENT,
} from '../notification-theme';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject } from 'rxjs';
import { CaretakerAlert, CaretakerApiService } from './caretaker-api.service';
import { TokenStorageService } from './token-storage.service';

const K_SEEN = 'medminder_caretaker_alert_seen_ids';

@Injectable({ providedIn: 'root' })
export class CaretakerAlertsService {
  private readonly unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount = this.unreadCount$.asObservable();

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private seenIds = new Set<string>();
  private loadedSeen = false;
  private polling = false;

  constructor(
    private readonly caretakerApi: CaretakerApiService,
    private readonly tokens: TokenStorageService
  ) {}

  async start(): Promise<void> {
    if (this.pollTimer) {
      return;
    }
    await this.refreshNow();
    this.pollTimer = setInterval(() => {
      void this.refreshNow();
    }, 60_000);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.unreadCount$.next(0);
  }

  async refreshNow(): Promise<void> {
    if (this.polling) {
      return;
    }
    if (!this.tokens.hasToken()) {
      this.unreadCount$.next(0);
      return;
    }
    this.polling = true;
    try {
      if (!this.loadedSeen) {
        const raw = await Preferences.get({ key: K_SEEN });
        const ids = (raw.value ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        this.seenIds = new Set(ids);
        this.loadedSeen = true;
      }
      const res = await this.caretakerApi.listAlerts(true, 20);
      this.unreadCount$.next(res.unreadCount);
      await this.notifyNewAlerts(res.alerts);
    } catch {
      /* keep last count */
    } finally {
      this.polling = false;
    }
  }

  private async ensureCaretakerAndroidChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      await LocalNotifications.createChannel({
        id: MM_ANDROID_CHANNEL_CARETAKER,
        name: 'MedMinder · Family alerts',
        description: 'Missed-dose alerts for people you care for — titled “Family alert · [name]”.',
        importance: 4,
        visibility: 1,
        lights: true,
        lightColor: MM_NOTIF_CARETAKER_ACCENT,
        vibration: true,
      });
    } catch {
      /* channel may exist */
    }
  }

  private async notifyNewAlerts(alerts: CaretakerAlert[]): Promise<void> {
    const fresh = alerts.filter((a) => !this.seenIds.has(a.id));
    if (fresh.length === 0) {
      return;
    }
    for (const a of fresh) {
      this.seenIds.add(a.id);
    }
    await Preferences.set({ key: K_SEEN, value: Array.from(this.seenIds).join(',') });
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') {
      return;
    }
    await this.ensureCaretakerAndroidChannel();
    const now = Date.now();
    const notifications: LocalNotificationSchema[] = fresh.map((a, idx) => {
      const n: LocalNotificationSchema = {
        id: this.notificationId(a.id, idx),
        title: `Family alert · ${a.profileName}`,
        body: `${a.profileName} missed ${a.medicationName} (due ${a.scheduledTime}, ${a.date}). Tap to open MedMinder.`,
        schedule: { at: new Date(now + 500 + idx * 150), allowWhileIdle: true },
      };
      if (Capacitor.getPlatform() === 'android') {
        n.channelId = MM_ANDROID_CHANNEL_CARETAKER;
        n.iconColor = MM_NOTIF_CARETAKER_ACCENT;
      }
      return n;
    });
    await LocalNotifications.schedule({ notifications });
  }

  private notificationId(seed: string, salt: number): number {
    let h = 0;
    const s = `${seed}|${salt}`;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return 100_000_000 + (h % 900_000_000);
  }
}

