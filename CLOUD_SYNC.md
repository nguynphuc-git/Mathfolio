# Cloud sync

Enable **Account → Enable cloud sync** on each browser/device using the same Firebase account. Saved exercises include folders/colors, problem text, opened hints, notes, completion, chat and all attached images. Workspace drafts remain local; **Save exercise** updates the synced copy. Cloud AI consent is separate: syncing does not run AI.

IndexedDB remains the working copy. Offline saves and deletions enter a durable outbox. Pause stops sync without deleting local/cloud pages. Sign in again to the same project and UID to resume. Do not clear browser storage until pending work has synced.

## Firebase setup for the assigned project

1. Create a **Cloud Firestore Standard** database with ID **(default)** in the existing project. Select production mode; the repository supplies private rules.
2. Create the **Storage** bucket. Storage requires a billing-enabled project; use the assigned quota project as agreed. Set `VITE_FIREBASE_STORAGE_BUCKET` in `.env.local` to the actual bucket name.
3. Keep Auth, the web app and App Check in this same project. Register the production hostname in Auth and the reCAPTCHA Enterprise site key. App Check enforcement can protect Firestore and Storage after the app obtains valid tokens. Debug tokens are development-only.
4. Deploy rules from the project folder:

```powershell
npx.cmd --no-install firebase deploy --only firestore:rules,storage --project fbailogic26vrt-3019
```

5. Downloads use authenticated Storage SDK calls, without public download URLs. Apply bucket CORS for the web origins in `cors.json`. In Google Cloud CLI, or Cloud Shell after uploading that file, run:

```sh
gcloud storage buckets update gs://fbailogic26vrt-3019.firebasestorage.app --cors-file=cors.json --project=fbailogic26vrt-3019
```

Use the actual bucket name if different. This changes CORS, not public access. Edit the origin list if the web domain changes.

6. Build with production flags:

```powershell
$env:VITE_USE_EMULATORS="false"
$env:VITE_APPCHECK_DEBUG="false"
npm.cmd run build
```

After build success, deploy the existing Mathfolio Hosting site:

```powershell
npx.cmd --no-install firebase deploy --only hosting --config firebase.mathfolio-mp.local.json --project fbailogic26vrt-3019
```

The local Hosting config targets site `mathfolio-mp`, public directory `dist`, and is not committed. Substitute project/bucket arguments when migrating. Cloud sync does not extend the assigned hackathon project's expiry.

## Storage and conflicts

- Firestore `/users/{uid}/notebook/{kind}~{id}` stores versioned index records. Complete exercise snapshots, including images, live at `users/{uid}/notebook-snapshots/{exerciseId}/{revision}.json`. Rules permit only the owner. Snapshots are immutable.
- Each snapshot is limited to **32 MiB**. Oversized pages or quota errors retain the entire local copy and queue; nothing is truncated. Split large exercises or remove images before retrying. Firebase usage is shared across the project/billing account, not a new free allowance for every Mathfolio user.
- Only changed records transfer. Keystrokes and unsaved drafts do not write to cloud. Saving an exercise uploads its complete snapshot again. Old committed snapshots are deleted on a best-effort basis; interrupted cleanup may leave unreferenced objects.
- Transactions check the previous cloud revision. Concurrent edits preserve the cloud version and a local **(conflict copy)**. Edits racing with deletion are kept. Tombstones prevent an unchanged offline device from resurrecting deleted pages. Folder deletion removes memberships, not exercises.
- Cloud pulls refresh the library without replacing an open Workspace draft. Saving a stale draft or preview preserves a conflict copy. The Account panel shows progress, pending changes and errors; **Sync now** retries after configuration/quota issues are fixed.

## Verification

```sh
npm test
npm run build
firebase emulators:exec --only auth,firestore,storage --project demo-studylens-local "node scripts/check-cloud-sync-rules.mjs"
```

The last command needs Java 21 and Firebase emulator binaries. The script refuses to run without emulator endpoints. It tests ownership, cross-account/anonymous denial, schema/version checks, immutable snapshots, size/type limits and tombstones.

For local end-to-end development, start Auth, Firestore and Storage emulators for `demo-studylens-local`, then Vite with `VITE_USE_EMULATORS=true`. The normal `npm run local` launcher starts Auth only; leave sync off unless the other two emulators are also running.
