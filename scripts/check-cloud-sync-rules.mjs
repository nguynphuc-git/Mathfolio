import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref, uploadBytes } from 'firebase/storage';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this check with the Auth, Firestore and Storage emulators. It never targets a live project.');
}
const projectId = process.env.GCLOUD_PROJECT || 'demo-mathfolio-sync';
const clients = [];
function client(name) {
  const app = initializeApp({ projectId, apiKey: 'demo-key', storageBucket: `${projectId}.firebasestorage.app` }, name);
  const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const [dbHost, dbPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':'); connectFirestoreEmulator(db, dbHost, Number(dbPort));
  const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':'); connectStorageEmulator(storage, storageHost, Number(storagePort));
  const result = { app, auth, db, storage }; clients.push(result); return result;
}
const alice = client('rules-alice'), bob = client('rules-bob'), guest = client('rules-guest');
let assertions = 0;
async function denied(operation) {
  await assert.rejects(operation, error => /permission-denied|unauthorized|unauthenticated/.test(error.code ?? ''));
  assertions++;
}
try {
  const { user: a } = await signInAnonymously(alice.auth); await signInAnonymously(bob.auth);
  const path = `users/${a.uid}/notebook-snapshots/first/revision-one.json`;
  const page = new TextEncoder().encode(JSON.stringify({ id: 'first', title: 'A page', image: 'data:image/png;base64,AA==' }));
  await uploadBytes(ref(alice.storage, path), page, { contentType: 'application/json' }); assertions++;
  assert.deepEqual(new Uint8Array(await getBytes(ref(alice.storage, path))), page); assertions++;
  await denied(() => getBytes(ref(bob.storage, path)));
  await denied(() => getBytes(ref(guest.storage, path)));
  await denied(() => uploadBytes(ref(bob.storage, path.replace('revision-one', 'bad-owner')), page, { contentType: 'application/json' }));
  await denied(() => uploadBytes(ref(alice.storage, path), page, { contentType: 'application/json' }));
  await denied(() => uploadBytes(ref(alice.storage, path.replace('revision-one', 'wrong-type')), page, { contentType: 'text/plain' }));
  await denied(() => uploadBytes(ref(alice.storage, path.replace('revision-one', 'too-big')), new Uint8Array(32 * 1024 * 1024 + 1), { contentType: 'application/json' }));
  const target = doc(alice.db, 'users', a.uid, 'notebook', 'exercise~first');
  const entry = { schema: 1, kind: 'exercise', id: 'first', revision: 'revision-one', generation: 1,
    deleted: false, payload: '', storagePath: path, previousStoragePath: '', updatedAt: serverTimestamp() };
  await setDoc(target, entry); assertions++;
  assert.equal((await getDoc(target)).data().revision, 'revision-one'); assertions++;
  assert.equal((await getDocs(collection(alice.db, 'users', a.uid, 'notebook'))).size, 1); assertions++;
  await denied(() => getDoc(doc(bob.db, 'users', a.uid, 'notebook', 'exercise~first')));
  await denied(() => getDocs(collection(bob.db, 'users', a.uid, 'notebook')));
  await denied(() => getDoc(doc(guest.db, 'users', a.uid, 'notebook', 'exercise~first')));
  await denied(() => setDoc(doc(bob.db, 'users', a.uid, 'notebook', 'exercise~other'), { ...entry, id: 'other' }));
  await denied(() => setDoc(target, { ...entry, revision: 'stale', updatedAt: serverTimestamp() }));
  await denied(() => setDoc(target, { ...entry, generation: 2, revision: 'bad-path', storagePath: `users/other/notebook-snapshots/first/bad-path.json` }));
  await denied(() => setDoc(target, { ...entry, generation: 2, revision: 'extra-field', storagePath: path.replace('revision-one', 'extra-field'), public: true }));
  await denied(() => setDoc(target, { ...entry, generation: 2, revision: 'wrong-previous', storagePath: path.replace('revision-one', 'wrong-previous'), previousStoragePath: '' }));
  await denied(() => deleteDoc(target));
  const folder = doc(alice.db, 'users', a.uid, 'notebook', 'folder~general');
  await setDoc(folder, { ...entry, kind: 'folder', id: 'general', revision: 'folder-one', storagePath: '', payload: JSON.stringify({ id: 'general', name: 'My exercises' }) }); assertions++;
  await setDoc(target, { ...entry, deleted: true, generation: 2, revision: 'delete-one', storagePath: '', previousStoragePath: path, updatedAt: serverTimestamp() }); assertions++;
  assert.equal((await getDoc(target)).data().deleted, true); assertions++;
  await deleteObject(ref(alice.storage, path)); assertions++;
  console.log(JSON.stringify({ assertions, result: 'passed', projectId }));
} finally { await Promise.all(clients.map(client => deleteApp(client.app))); }
