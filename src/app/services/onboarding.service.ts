import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { MedDataService } from './med-data.service';

const K_COMPLETE = 'medminder_onboarding_complete';
const K_AUDIENCE = 'medminder_onboarding_audience';

export type OnboardingAudience = 'self' | 'family' | 'multiple';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  constructor(private readonly medData: MedDataService) {}

  async isComplete(): Promise<boolean> {
    const { value } = await Preferences.get({ key: K_COMPLETE });
    return value === 'true';
  }

  async setComplete(): Promise<void> {
    await Preferences.set({ key: K_COMPLETE, value: 'true' });
  }

  /** Optional UX context from step 2 (“Who are you tracking for?”). */
  async setAudience(audience: OnboardingAudience): Promise<void> {
    await Preferences.set({ key: K_AUDIENCE, value: audience });
  }

  /**
   * Existing users (already have profiles) skip onboarding once.
   * Call after `medData.load()` when logged in.
   */
  async migrateIfHasExistingData(): Promise<void> {
    if (await this.isComplete()) {
      return;
    }
    if (this.medData.getProfilesSnapshot().length > 0) {
      await this.setComplete();
    }
  }
}
