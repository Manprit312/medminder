import { Injectable } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private app: FirebaseApp | null = null;

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

  async getGoogleIdToken(): Promise<string> {
    const auth = getAuth(this.getApp());
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return cred.user.getIdToken();
  }
}
