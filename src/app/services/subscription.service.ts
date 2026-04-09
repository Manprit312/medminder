import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Client-side plan tier. Replace with API / store billing when ready.
 * Free: one profile, reminders, dose logging, basic Today view.
 * Plus: multiple family profiles, caregiver contacts, education hub.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  /** True when user is on MedMinder Plus (premium). */
  get isPremium(): boolean {
    return environment.subscriptionTier === 'premium';
  }

  /** Additional profiles beyond the first require Plus. */
  canAddProfile(currentProfileCount: number): boolean {
    if (this.isPremium) {
      return true;
    }
    return currentProfileCount < 1;
  }

  /** Caregiver email/phone on profiles are a Plus feature. */
  canUseCaregiverFields(): boolean {
    return this.isPremium;
  }

  /** Curated reference links & expanded education — Plus only (see Education page). */
  canUseEducationHub(): boolean {
    return this.isPremium;
  }
}
