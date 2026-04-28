export const environment = {
  production: true,
  // apiUrl: 'https://medminder-zhjh.onrender.com',
  apiUrl: 'http://localhost:3847',
  /** Production default until billing / API assigns tiers. */
  subscriptionTier: 'free' as 'free' | 'premium',
  firebase: {
    apiKey: 'AIzaSyDbv76cPwWd-sVmuFNFvNz44QmD758OHYk',
    authDomain: 'medminder-33713.firebaseapp.com',
    projectId: 'medminder-33713',
    appId: '1:926270091656:web:64606d3c0accbab6918a3d',
  },
  /** Razorpay publishable key ID (safe to expose in frontend). Use rzp_live_... for production. */
  razorpayKeyId: '',
};
