export const environment = {
  production: true,
  apiUrl: 'https://medminder-zhjh.onrender.com',
  // apiUrl: 'http://localhost:3847',
  /** Production default until billing / API assigns tiers. */
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
  /** Same as dev — Web client ID for @codetrix-studio/capacitor-google-auth on native builds. */
  googleWebClientId: '496540692342-jojci0pl58bgk285jkvooo094g484sf8.apps.googleusercontent.com',
  /** Razorpay publishable key ID (safe to expose in frontend). Use rzp_live_... for production. */
  razorpayKeyId: '',
};
