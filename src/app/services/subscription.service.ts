import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';
import { TokenStorageService } from './token-storage.service';

/**
 * Plan tier: server `/api/auth/me` when logged in; falls back to `environment.subscriptionTier`.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly tier$ = new BehaviorSubject<'free' | 'premium'>(this.envDefault());

  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorageService
  ) {}

  private envDefault(): 'free' | 'premium' {
    return environment.subscriptionTier === 'premium' ? 'premium' : 'free';
  }

  readonly tier = this.tier$.asObservable();

  /** True when user is on MedMinder Plus (premium). */
  get isPremium(): boolean {
    return this.tier$.value === 'premium';
  }

  applyFromAuthUser(user: { subscriptionTier?: string } | undefined | null): void {
    const t = user?.subscriptionTier === 'premium' ? 'premium' : 'free';
    this.tier$.next(t);
  }

  resetToEnvironmentDefault(): void {
    this.tier$.next(this.envDefault());
  }

  /** Refresh tier from GET /api/auth/me (Bearer token via interceptor). */
  async refreshFromApi(): Promise<void> {
    if (!this.tokens.hasToken()) {
      this.resetToEnvironmentDefault();
      return;
    }
    try {
      const res = await firstValueFrom(
        withApiTimeout(
          this.http.get<{ user: { subscriptionTier?: string } }>(`${getApiUrl()}/api/auth/me`)
        )
      );
      this.applyFromAuthUser(res.user);
    } catch {
      /* keep last known tier */
    }
  }

  /**
   * Dev/staging: POST /api/billing/simulate-tier — disabled in production unless DEV_BILLING_SIMULATION is set server-side.
   */
  async simulateTier(tier: 'free' | 'premium'): Promise<void> {
    const res = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ subscriptionTier: string }>(`${getApiUrl()}/api/billing/simulate-tier`, {
          tier: tier === 'premium' ? 'premium' : 'free',
        })
      )
    );
    this.applyFromAuthUser({ subscriptionTier: res.subscriptionTier });
  }

  canAddProfile(currentProfileCount: number): boolean {
    if (this.isPremium) {
      return true;
    }
    return currentProfileCount < 1;
  }

  canUseCaregiverFields(): boolean {
    return this.isPremium;
  }

  canUseEducationHub(): boolean {
    return this.isPremium;
  }
}
