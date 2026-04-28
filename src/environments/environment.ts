export const environment = {
  production: false,
  /** MedMinder API (run `npm run dev` in /backend). Native Android emulator: use `getApiUrl()` (maps localhost → 10.0.2.2). Physical device: set your machine’s LAN IP here. */
  // apiUrl: 'https://medminder-zhjh.onrender.com',
  apiUrl: 'http://localhost:3847',
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
  /** Razorpay publishable key ID (safe to expose in frontend). Use rzp_test_... for dev. */
  razorpayKeyId: '',
};
