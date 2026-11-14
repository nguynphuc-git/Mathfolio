import { getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
let ready = false;
export function getFirebaseApp() {
const env = import.meta.env;
const config = {
apiKey: env.VITE_FIREBASE_API_KEY,
authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
projectId: env.VITE_FIREBASE_PROJECT_ID,
appId: env.VITE_FIREBASE_APP_ID
};
if (Object.values(config).some(v => !v || /REPLACE|YOUR_PROJECT/.test(v)))
throw new Error('Chưa cấu hình Firebase. Sao chép .env.example thành .env.local và điền Web app config.');
const app = getApps()[0] ?? initializeApp({ ...config, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET });
if (!ready) {
const key = env.VITE_RECAPTCHA_SITE_KEY;
if (!key || key === 'REPLACE_ME') throw new Error('Thiếu reCAPTCHA Enterprise site key.');
if (import.meta.env.DEV && env.VITE_APPCHECK_DEBUG === 'true') {
(self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
initializeAppCheck(app, {
provider: new ReCaptchaEnterpriseProvider(key),
isTokenAutoRefreshEnabled: true
});
ready = true;
}
return app;
}
