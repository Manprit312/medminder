import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingService } from '../services/onboarding.service';
import { TokenStorageService } from '../services/token-storage.service';

/** Logged-in users only. */
export const tokenGuard: CanActivateFn = () => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);
  if (!tokens.hasToken()) {
    return router.parseUrl('/login');
  }
  return true;
};

/** Main app (tabs): requires login + finished onboarding. */
export const authGuard: CanActivateFn = async () => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  if (!tokens.hasToken()) {
    return router.parseUrl('/login');
  }
  await onboarding.syncCompletionWithServerProfiles();
  if (!(await onboarding.isComplete())) {
    return router.parseUrl('/onboarding');
  }
  return true;
};
