import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingService } from '../services/onboarding.service';
import { TokenStorageService } from '../services/token-storage.service';

/** Onboarding wizard: only when logged in and onboarding not finished. */
export const onboardingIncompleteGuard: CanActivateFn = async () => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  if (!tokens.hasToken()) {
    return router.parseUrl('/login');
  }
  await onboarding.syncCompletionWithServerProfiles();
  if (await onboarding.isComplete()) {
    return router.parseUrl('/tabs/today');
  }
  return true;
};
