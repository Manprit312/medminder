import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../../environments/api-url';
import { withApiTimeout } from '../shared/http-api-timeout';
import { TokenStorageService } from './token-storage.service';
import { RazorpayCheckoutService } from './razorpay-checkout.service';

/**
 * Plan tier: server `/api/auth/me` when logged in; falls back to `environment.subscriptionTier`.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly tier$ = new BehaviorSubject<'free' | 'premium'>(this.envDefault());

  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorageService,
    private readonly razorpay: RazorpayCheckoutService
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

  /** Free tier: max 5 medications per profile. Plus: unlimited. */
  canAddMedication(currentMedCount: number): boolean {
    if (this.isPremium) {
      return true;
    }
    return currentMedCount < 5;
  }

  canUseCaregiverFields(): boolean {
    return this.isPremium;
  }

  canUseEducationHub(): boolean {
    return this.isPremium;
  }

  /**
   * Full Razorpay lifetime purchase flow:
   * 1. Create server-side order
   * 2. Open Razorpay checkout modal
   * 3. Verify payment server-side → tier set to premium
   * 4. Update local tier signal
   *
   * Throws on failure or cancellation so the caller can show a toast.
   */
  async buyLifetime(prefill?: { name?: string; email?: string }): Promise<void> {
    const apiUrl = getApiUrl();

    // Step 1: create order on server
    const order = await firstValueFrom(
      withApiTimeout(
        this.http.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
          `${apiUrl}/api/billing/razorpay/create-order`,
          {}
        )
      )
    );

    // Step 2: open Razorpay checkout (throws if cancelled)
    const keyId = order.keyId || environment.razorpayKeyId;
    const result = await this.razorpay.openCheckout({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId,
      prefill,
    });

    // Step 3: verify on server
    await firstValueFrom(
      withApiTimeout(
        this.http.post<{ ok: boolean; subscriptionTier: string }>(
          `${apiUrl}/api/billing/razorpay/verify`,
          result
        )
      )
    );

    // Step 4: update local tier
    this.tier$.next('premium');
  }
}
