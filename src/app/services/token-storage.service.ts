import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const K_TOKEN = 'medminder_jwt';
const K_EMAIL = 'medminder_email';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private token: string | null = null;
  private email: string | null = null;

  async restoreSession(): Promise<void> {
    const [t, e] = await Promise.all([
      Preferences.get({ key: K_TOKEN }),
      Preferences.get({ key: K_EMAIL }),
    ]);
    this.token = t.value;
    this.email = e.value;
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  getToken(): string | null {
    return this.token;
  }

  getEmail(): string | null {
    return this.email;
  }

  async setSession(token: string, email: string): Promise<void> {
    this.token = token;
    this.email = email;
    await Promise.all([
      Preferences.set({ key: K_TOKEN, value: token }),
      Preferences.set({ key: K_EMAIL, value: email }),
    ]);
  }

  async clear(): Promise<void> {
    this.token = null;
    this.email = null;
    await Promise.all([Preferences.remove({ key: K_TOKEN }), Preferences.remove({ key: K_EMAIL })]);
  }
}
