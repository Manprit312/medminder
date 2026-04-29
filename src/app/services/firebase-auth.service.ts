import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, getRedirectResult, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private app: FirebaseApp | null = null;
  private readonly redirectInitiatedMessage = 'GOOGLE_REDIRECT_INITIATED';

  private get configured(): boolean {
    const c = environment.firebase;
    return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
  }

  private getApp(): FirebaseApp {
    if (!this.configured) {
      throw new Error('Google sign-in is not configured yet. Add Firebase keys in environment files.');
    }
    if (!this.app) {
      this.app = initializeApp(environment.firebase);
    }
    return this.app;
  }

  /**
   * Opens Google sign-in and returns a Firebase ID token for `/api/auth/google`.
   * On native (Capacitor), uses the native Google Sign-In sheet — required because
   * Firebase popup/redirect opens Chrome and leaves a blank page that never returns to the WebView.
   */
  startGoogleSignIn(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      return this.startGoogleSignInNative();
    }

    const auth = getAuth(this.getApp());
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider)
      .then(cred => cred.user.getIdToken())
      .catch(async err => {
        const code =
          typeof err === 'object' && err && 'code' in err
            ? String((err as { code: unknown }).code ?? '')
            : '';
        if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, provider);
          throw new Error(this.redirectInitiatedMessage);
        }
        throw err;
      });
  }

  private async startGoogleSignInNative(): Promise<string> {
    const webClientId = environment.googleWebClientId?.trim();
    if (!webClientId) {
      throw new Error(
        'Set googleWebClientId in environment (OAuth 2 Web client ID from Google Cloud / Firebase). ' +
          'Native sign-in will not work without it.'
      );
    }
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
    try {
      await GoogleAuth.initialize({
        clientId: webClientId,
        scopes: ['profile', 'email'],
        grantOfflineAccess: false,
      });
      const user = await GoogleAuth.signIn();
      const idToken = user.authentication?.idToken;
      if (!idToken) {
        throw new Error(this.nativeGoogleMissingIdTokenMessage());
      }
      return idToken;
    } catch (err: unknown) {
      throw new Error(this.explainNativeGoogleError(err));
    }
  }

  private nativeGoogleMissingIdTokenMessage(): string {
    return (
      'Google did not return an ID token. Open Firebase Console → Project settings → Your apps → Android ' +
      '(app.medminder.app) and add your debug SHA-1: run `cd android && ./gradlew signingReport`, copy SHA1 under debug.'
    );
  }

  /** Turn vague Capacitor / Google Play Services errors into fix hints (status 10 = DEVELOPER_ERROR). */
  private explainNativeGoogleError(err: unknown): string {
    const raw =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
    const lower = raw.toLowerCase();

    if (lower.includes('cancel') || lower.includes('12501')) {
      return 'Sign-in was cancelled.';
    }

    // Plugin passes status code as second line sometimes: "Something went wrong" + "10"
    if (raw.includes('10') || lower.includes('developer_error') || lower.includes('developer error')) {
      return (
        'Google Sign-In setup error (code 10). Fix: (1) Firebase Console → Project settings → Your apps → add Android app ' +
        '`app.medminder.app` if missing. (2) Add SHA-1 fingerprint: run `cd android && ./gradlew signingReport`, copy SHA1 from the debug variant, paste into Firebase Android app. ' +
        '(3) Download fresh google-services.json into android/app/ if you use it. Then rebuild the app.'
      );
    }

    if (lower.includes('something went wrong')) {
      return (
        `${raw}. Usually: add your debug SHA-1 in Firebase for package app.medminder.app, or confirm googleWebClientId is the OAuth "Web client" ID from the same Google Cloud project as Firebase.`
      );
    }

    return raw || 'Google sign-in failed.';
  }

  /** Signs out of the native Google session (no-op on web). Safe to call even if not signed in with Google. */
  async signOutGoogleSession(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      await GoogleAuth.signOut();
    } catch {
      /* ignore */
    }
  }

  async consumeGoogleRedirectResult(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      return null;
    }
    const auth = getAuth(this.getApp());
    const result = await getRedirectResult(auth);
    if (!result?.user) {
      return null;
    }
    return result.user.getIdToken();
  }

  isRedirectInitiatedError(err: unknown): boolean {
    return err instanceof Error && err.message === this.redirectInitiatedMessage;
  }
}
