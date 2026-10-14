import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function formatPrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
}

function initializeFirebaseAdmin(): App {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    return currentApps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const serviceAccountKeyRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKeyRaw) {
    try {
      const parsed = JSON.parse(serviceAccountKeyRaw);
      return initializeApp({
        credential: cert(parsed),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', err);
    }
  }

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  // Fallback to ADC (Application Default Credentials) or default app
  return initializeApp({
    projectId: projectId || 'ipl-auction-pro',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminApp = initializeFirebaseAdmin();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);

// Configure Firestore settings
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch {
  // Settings already locked in certain runtimes
}
