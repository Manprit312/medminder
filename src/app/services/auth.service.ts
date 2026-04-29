import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';
import { SubscriptionService } from './subscription.service';
import { TokenStorageService } from './token-storage.service';
import { FirebaseAuthService } from './firebase-auth.service';

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  subscriptionTier?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorageService,
    private readonly subscription: SubscriptionService,
    private readonly firebaseAuth: FirebaseAuthService
  ) {}

  isLoggedIn(): boolean {
    return this.tokens.hasToken();
  }

  getToken(): string | null {
    return this.tokens.getToken();
  }

  /** Display line in Settings: phone (OTP) or legacy email. */
  getUserDisplay(): string | null {
    return this.tokens.getUserDisplay();
  }

  /** @deprecated Use getUserDisplay — kept for templates that still reference email. */
  getEmail(): string | null {
    return this.getUserDisplay();
  }

  async requestOtp(phone: string): Promise<{ devOtp?: string; smsSent?: boolean }> {
    return firstValueFrom(
      withApiTimeout(
        this.http.post<{ ok?: boolean; devOtp?: string; smsSent?: boolean }>(`${getApiUrl()}/api/auth/otp/request`, {
          phone: phone.trim(),
        })
      )
    );
  }

  async verifyOtp(phone: string, code: string): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ token: string; user: AuthUser }>(`${getApiUrl()}/api/auth/otp/verify`, {
          phone: phone.trim(),
          code: code.trim(),
        })
      )
    );
    const label = res.user.phone?.trim() || res.user.email?.trim() || '';
    await this.tokens.setSession(res.token, label);
    this.subscription.applyFromAuthUser(res.user);
  }

  async loginWithGoogleIdToken(idToken: string): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ token: string; user: AuthUser }>(`${getApiUrl()}/api/auth/google`, {
          idToken,
        })
      )
    );
    const label = res.user.phone?.trim() || res.user.email?.trim() || '';
    await this.tokens.setSession(res.token, label);
    this.subscription.applyFromAuthUser(res.user);
  }

  /** Legacy email + password (server may still accept if user has a password). */
  async loginWithPassword(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ token: string; user: AuthUser }>(`${getApiUrl()}/api/auth/login`, {
          email: email.trim().toLowerCase(),
          password,
        })
      )
    );
    const label = res.user.phone?.trim() || res.user.email?.trim() || '';
    await this.tokens.setSession(res.token, label);
    this.subscription.applyFromAuthUser(res.user);
  }

  async register(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ token: string; user: AuthUser }>(`${getApiUrl()}/api/auth/register`, {
          email: email.trim().toLowerCase(),
          password,
        })
      )
    );
    const label = res.user.phone?.trim() || res.user.email?.trim() || '';
    await this.tokens.setSession(res.token, label);
    this.subscription.applyFromAuthUser(res.user);
  }

  /**
   * Validates the stored token against the backend.
   * Clears the session if the token is stale/invalid (e.g. user deleted, DB reset).
   * Returns true if the session is valid.
   */
  async verifySession(): Promise<boolean> {
    if (!this.tokens.hasToken()) {
      return false;
    }
    try {
      await firstValueFrom(
        withApiTimeout(this.http.get<unknown>(`${getApiUrl()}/api/auth/me`))
      );
      return true;
    } catch {
      await this.tokens.clear();
      this.subscription.resetToEnvironmentDefault();
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.firebaseAuth.signOutGoogleSession();
    await this.tokens.clear();
    this.subscription.resetToEnvironmentDefault();
  }

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

  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(
      withApiTimeout(
        this.http.post<{ ok?: boolean; message?: string }>(`${getApiUrl()}/api/auth/reset-password`, {
          token: token.trim(),
          password,
        })
      )
    );
  }
}
