export const environment = {
  production: false,
  /** Backend API. Use hosted URL on real phones — `localhost` only works in the desktop browser or Android emulator (see getApiUrl). */
  apiUrl: 'https://medminder-zhjh.onrender.com',
  /** Local backend (ionic serve + `npm run dev`): switch apiUrl to this and open in browser only; for emulator use localhost (rewritten to 10.0.2.2). Physical device + local API: use `http://YOUR_LAN_IP:3847`. */
  // apiUrl: 'http://localhost:3847',
  /**
   * `free` — one profile, core reminders & logging.
   * `premium` (MedMinder Plus) — family profiles, caregiver fields, education hub.
   * Use `free` locally to test gating.
   */
  /** Fallback before `/api/auth/me` loads; real tier comes from the server when signed in. */
  subscriptionTier: 'free' as 'free' | 'premium',
  firebase: {
    apiKey: 'AIzaSyDbv76cPwWd-sVmuFNFvNz44QmD758OHYk',
    authDomain: 'medminder-33713.firebaseapp.com',
    projectId: 'medminder-33713',
    appId: '1:926270091656:web:64606d3c0accbab6918a3d',
  },
  /**
   * OAuth 2.0 **Web client** ID — must match production native builds (same ID as environment.prod).
   */
  googleWebClientId: '926270091656-kfirh36lbdch3mtftcdmekis0psfh75i.apps.googleusercontent.com',
  /** Razorpay publishable key ID (safe to expose in frontend). Use rzp_test_... for dev. */
  razorpayKeyId: '',
};
