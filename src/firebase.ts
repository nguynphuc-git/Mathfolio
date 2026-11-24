import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'firebase/app-check';

let cloudReady = false;

function getLocalFirebaseApp() {
  const name = 'studylens-local';
  const existing = getApps().find(app => app.name === name);
  if (existing) return existing;

  const app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId: 'demo-studylens-local',
    appId: 'demo-studylens-local',
    storageBucket: 'demo-studylens-local.firebasestorage.app'
  }, name);

  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099');
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  connectStorageEmulator(getStorage(app), '127.0.0.1', 9199);

  return app;
}

// Dùng cho tài khoản và thư viện tài liệu.
export function getFirebaseApp() {
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_EMULATORS === 'true'
  ) {
    return getLocalFirebaseApp();
  }

  return getConfiguredFirebaseApp(false);
}

// The SDK uses the real project even for strictly on-device inference.
export function getCloudFirebaseApp(requireAppCheck = true) {
  return getConfiguredFirebaseApp(requireAppCheck);
}

function getConfiguredFirebaseApp(requireAppCheck: boolean) {
  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };

  if (Object.values(config).some(v => !v || /REPLACE|YOUR_PROJECT/.test(v))) {
    throw new Error('Firebase Web configuration is missing from .env.local.');
  }

  const app = getApps().find(app => app.name === '[DEFAULT]')
    ?? initializeApp({
      ...config,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    });

  if (!cloudReady) {
    const key = env.VITE_RECAPTCHA_SITE_KEY;

    if (!key || /REPLACE|YOUR_/.test(key)) {
      // Auth and the local notebook work on a personal Spark project before AI setup.
      // Enforced backend rules still reject requests without a valid App Check token.
      if (requireAppCheck) throw new Error('Set up App Check for this Firebase project before using Cloud AI.');
      return app;
    }

    if (import.meta.env.DEV && env.VITE_APPCHECK_DEBUG === 'true') {
      (self as typeof self & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean;
      }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(key),
      isTokenAutoRefreshEnabled: true
    });

    cloudReady = true;
  }

  return app;
}
