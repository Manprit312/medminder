import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';
import { SubscriptionService } from './subscription.service';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorageService,
    private readonly subscription: SubscriptionService
  ) {}

  isLoggedIn(): boolean {
    return this.tokens.hasToken();
  }

  getToken(): string | null {
    return this.tokens.getToken();
  }

  getEmail(): string | null {
    return this.tokens.getEmail();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ token: string; user: { email: string; subscriptionTier?: string } }>(
          `${getApiUrl()}/api/auth/login`,
          { email: email.trim().toLowerCase(), password }
        )
      )
    );
    await this.tokens.setSession(res.token, res.user.email);
    this.subscription.applyFromAuthUser(res.user);
  }

  async register(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ token: string; user: { email: string; subscriptionTier?: string } }>(
          `${getApiUrl()}/api/auth/register`,
          { email: email.trim().toLowerCase(), password }
        )
      )
    );
    await this.tokens.setSession(res.token, res.user.email);
    this.subscription.applyFromAuthUser(res.user);
  }

  async logout(): Promise<void> {
    await this.tokens.clear();
    this.subscription.resetToEnvironmentDefault();
  }

  /** Request a password-reset email (backend sends mail when SMTP is configured). */
  async requestPasswordReset(email: string): Promise<{ devResetUrl?: string }> {
    return firstValueFrom(
      withApiTimeout(
        this.http.post<{ ok?: boolean; message?: string; devResetUrl?: string }>(
          `${getApiUrl()}/api/auth/forgot-password`,
          { email: email.trim().toLowerCase() }
        )
      )
    );
  }

  /** Complete reset using the token from the email link. */
  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(
      withApiTimeout(
        this.http.post<{ ok?: boolean; message?: string }>(
          `${getApiUrl()}/api/auth/reset-password`,
          { token: token.trim(), password }
        )
      )
    );
  }
}
