export const environment = {
  production: false,
  /** MedMinder API (run `npm run dev` in /backend). Native Android emulator: use `getApiUrl()` (maps localhost → 10.0.2.2). Physical device: set your machine’s LAN IP here. */
  apiUrl: 'https://medminder-zhjh.onrender.com',
  /**
   * `free` — one profile, core reminders & logging.
   * `premium` (MedMinder Plus) — family profiles, caregiver fields, education hub.
   * Use `free` locally to test gating.
   */
  subscriptionTier: 'premium' as 'free' | 'premium',
};
