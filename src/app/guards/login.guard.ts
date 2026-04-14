import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingService } from '../services/onboarding.service';
import { TokenStorageService } from '../services/token-storage.service';

/** Logged-out users only; logged-in users go to onboarding or Today. */
export const loginGuard: CanActivateFn = async () => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  if (!tokens.hasToken()) {
    return true;
  }
  await onboarding.syncCompletionWithServerProfiles();
  if (!(await onboarding.isComplete())) {
    return router.parseUrl('/onboarding');
  }
  return router.parseUrl('/tabs/today');
};
