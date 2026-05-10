export const environment = {
  production: false,
  /** Backend API. Use hosted URL on real phones — `localhost` only works in the desktop browser or Android emulator (see getApiUrl). */
  apiUrl: 'https://medminder-zhjh.onrender.com',
  // apiUrl: 'http://localhost:3847',
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
    apiKey: 'AIzaSyBmzp-y_ZumiWDRdFYVMZGosS6l6eu6GV8',
    authDomain: 'medminder-3d4c6.firebaseapp.com',
    projectId: 'medminder-3d4c6',
    storageBucket: 'medminder-3d4c6.firebasestorage.app',
    messagingSenderId: '496540692342',
    appId: '1:496540692342:web:23c015f25bedaedd0ed457',
    measurementId: 'G-QVQMWL8JNV',
  },
  /**
   * OAuth 2.0 **Web client** ID — must match production native builds (same ID as environment.prod).
   */
  googleWebClientId: '496540692342-jojci0pl58bgk285jkvooo094g484sf8.apps.googleusercontent.com',
  /** Razorpay publishable key ID (safe to expose in frontend). Use rzp_test_... for dev. */
  razorpayKeyId: '',
};
