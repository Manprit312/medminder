import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
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
    const now = Date.now();
    await LocalNotifications.schedule({
      notifications: fresh.map((a, idx) => ({
        id: this.notificationId(a.id, idx),
        title: `${a.profileName} missed medicine`,
        body: `${a.medicationName} at ${a.scheduledTime} on ${a.date}.`,
        schedule: { at: new Date(now + 500 + idx * 150), allowWhileIdle: true },
      })),
    });
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

