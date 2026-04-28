import { Injectable } from '@angular/core';
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
   * Opens the Google sign-in popup and returns a promise for the Firebase ID token.
   *
   * IMPORTANT: call this synchronously from the click handler — before any `await` —
   * so the browser treats the popup as a direct user gesture and does not block it.
   * If the popup is blocked fall back to redirect automatically.
   */
  startGoogleSignIn(): Promise<string> {
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

  async consumeGoogleRedirectResult(): Promise<string | null> {
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
