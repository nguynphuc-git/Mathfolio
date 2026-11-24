import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Firebase Web configuration is public; never add server credentials here.
const config = JSON.parse(readFileSync(new URL('../config/firebase.personal.json', import.meta.url), 'utf8'));
const env = { ...process.env,
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
  VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
  // Do not inherit the expiring project's site key/model from .env.local or the shell.
  VITE_RECAPTCHA_SITE_KEY: process.env.MATHFOLIO_PERSONAL_RECAPTCHA_SITE_KEY || '',
  VITE_CLOUD_MODEL: process.env.MATHFOLIO_PERSONAL_CLOUD_MODEL || '',
  VITE_USE_EMULATORS: 'false',
  VITE_APPCHECK_DEBUG: 'false',
};
console.log(`Building for personal Firebase project ${config.projectId}`);
// Windows needs npm.cmd; shell is used only with this fixed, argument-free command.
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  stdio: 'inherit', env, shell: process.platform === 'win32',
  cwd: new URL('..', import.meta.url),
});
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
