import { existsSync } from 'node:fs';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function ensureFirebaseAdminReady(): void {
  if (getApps().length > 0) {
    return;
  }

  /** Prefer a downloaded service account JSON — avoids multiline private key issues in `.env`. */
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (gac && existsSync(gac)) {
    initializeApp({ credential: applicationDefault() });
    console.log('[firebase-admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file.');
    return;
  }

  const projectId = env('FIREBASE_PROJECT_ID');
  const clientEmail = env('FIREBASE_CLIENT_EMAIL');
  const privateKey = env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path, or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
    );
  }
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  console.log('[firebase-admin] Initialized with FIREBASE_* env vars (inline private key).');
}

export async function verifyFirebaseIdToken(idToken: string) {
  ensureFirebaseAdminReady();
  return getAuth().verifyIdToken(idToken, true);
}
