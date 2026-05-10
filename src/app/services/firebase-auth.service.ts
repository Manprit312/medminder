import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, getRedirectResult, signInWithCredential, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
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
      /** Backend uses Firebase Admin `verifyIdToken` — needs a Firebase ID token, not the raw Google OAuth token from the native SDK. */
      const auth = getAuth(this.getApp());
      const accessToken = user.authentication?.accessToken ?? undefined;
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const firebaseCred = await signInWithCredential(auth, credential);
      return firebaseCred.user.getIdToken();
    } catch (err: unknown) {
      throw new Error(this.explainNativeGoogleError(err));
    }
  }

  private nativeGoogleMissingIdTokenMessage(): string {
    return (
      'Google did not return an ID token. In Firebase → Android app app.medminder.med, add SHA-1 + SHA-256 from ' +
        '`./gradlew signingReport` (use **debug** for dev builds, **release** for signed release APKs), then rebuild.'
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
        'Google Sign-In setup error (code 10 / DEVELOPER_ERROR). Do this in Firebase (project medminder-3d4c6): ' +
          'Project settings → Your apps → Android `app.medminder.med` → Add fingerprint. ' +
          'Run `cd android && ./gradlew signingReport` and add **both** SHA-1 and SHA-256 for **debug** (dev builds) ' +
          'and **release** (Play/APK you install). Save, wait ~5 min, then rebuild the app. ' +
          'Also confirm Authentication → Sign-in method → Google is enabled.'
      );
    }

    if (lower.includes('something went wrong')) {
      return (
        `${raw} — Most often: (1) Firebase → Android app \`app.medminder.med\` is missing **SHA-1** (and **SHA-256**) from \`./gradlew signingReport\` for the variant you run (debug vs release). ` +
          `(2) \`googleWebClientId\` must be the **Web client** OAuth ID from Google Cloud **for the same project** as Firebase (Firebase console → Project settings → Your apps, or APIs & Services → Credentials → Web client). ` +
          `(3) After changing Firebase, sync \`android/app/google-services.json\` and rebuild.`
      );
    }

    return raw || 'Google sign-in failed.';
  }

  /** Signs out Firebase + native Google session on device; Firebase only on web after Google popup. */
  async signOutGoogleSession(): Promise<void> {
    try {
      const auth = getAuth(this.getApp());
      await signOut(auth);
    } catch {
      /* ignore */
    }
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
