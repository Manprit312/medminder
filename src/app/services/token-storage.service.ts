import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const K_TOKEN = 'medminder_jwt';
/** Human-readable account id: E.164 phone or legacy email */
const K_USER_DISPLAY = 'medminder_user_display';
const K_EMAIL_LEGACY = 'medminder_email';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private token: string | null = null;
  private userDisplay: string | null = null;

  async restoreSession(): Promise<void> {
    const [t, display, legacyEmail] = await Promise.all([
      Preferences.get({ key: K_TOKEN }),
      Preferences.get({ key: K_USER_DISPLAY }),
      Preferences.get({ key: K_EMAIL_LEGACY }),
    ]);
    this.token = t.value;
    this.userDisplay = display.value ?? legacyEmail.value;
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  getToken(): string | null {
    return this.token;
  }

  getUserDisplay(): string | null {
    return this.userDisplay;
  }

  /** @deprecated Use getUserDisplay */
  getEmail(): string | null {
    return this.userDisplay;
  }

  async setSession(token: string, userDisplay: string): Promise<void> {
    this.token = token;
    this.userDisplay = userDisplay;
    await Promise.all([
      Preferences.set({ key: K_TOKEN, value: token }),
      Preferences.set({ key: K_USER_DISPLAY, value: userDisplay }),
      Preferences.remove({ key: K_EMAIL_LEGACY }),
    ]);
  }

  async clear(): Promise<void> {
    this.token = null;
    this.userDisplay = null;
    await Promise.all([
      Preferences.remove({ key: K_TOKEN }),
      Preferences.remove({ key: K_USER_DISPLAY }),
      Preferences.remove({ key: K_EMAIL_LEGACY }),
    ]);
  }
}
