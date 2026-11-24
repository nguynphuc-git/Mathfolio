import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ apps: [] as any[], initialize: vi.fn(), check: vi.fn(), provider: vi.fn() }));
vi.mock('firebase/app', () => ({ getApps: () => mocks.apps, initializeApp: mocks.initialize }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(), connectAuthEmulator: vi.fn() }));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(), connectFirestoreEmulator: vi.fn() }));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), connectStorageEmulator: vi.fn() }));
vi.mock('firebase/app-check', () => ({ initializeAppCheck: mocks.check, ReCaptchaEnterpriseProvider: class { constructor(key: string) { mocks.provider(key); } } }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); mocks.apps = [];
  mocks.initialize.mockImplementation((options, name = '[DEFAULT]') => { const app = { name, options }; mocks.apps.push(app); return app; });
  vi.stubEnv('VITE_USE_EMULATORS', 'false'); vi.stubEnv('VITE_APPCHECK_DEBUG', 'false');
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'public-web-key'); vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'personal.firebaseapp.com');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'personal'); vi.stubEnv('VITE_FIREBASE_APP_ID', 'personal-app');
  vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'personal.firebasestorage.app'); vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());
describe('personal project setup', () => {
  it('opens Auth/local notebooks without AI configuration and still refuses Cloud AI without App Check', async () => {
    const { getFirebaseApp, getCloudFirebaseApp } = await import('../src/firebase');
    expect(getFirebaseApp().options.projectId).toBe('personal');
    expect(getCloudFirebaseApp(false)).toBe(getFirebaseApp());
    expect(mocks.check).not.toHaveBeenCalled();
    expect(() => getCloudFirebaseApp()).toThrow('Set up App Check');
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });
  it('initializes App Check once for both Auth and Cloud AI when the personal site key is supplied', async () => {
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'personal-site-key');
    const { getFirebaseApp, getCloudFirebaseApp } = await import('../src/firebase');
    expect(getCloudFirebaseApp()).toBe(getFirebaseApp());
    expect(mocks.check).toHaveBeenCalledTimes(1); expect(mocks.provider).toHaveBeenCalledWith('personal-site-key');
  });
  it('continues rejecting missing Firebase configuration instead of using the expiring project', async () => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'YOUR_PROJECT');
    const { getFirebaseApp } = await import('../src/firebase');
    expect(() => getFirebaseApp()).toThrow('configuration is missing');
    expect(mocks.initialize).not.toHaveBeenCalled();
  });
});
