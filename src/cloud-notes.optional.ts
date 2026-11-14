// Optional extension; the main app does NOT import this module or sync by itself.
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
export async function syncNoteAfterConsent(id: string, title: string, markdown: string) {
if (title.length > 200 || markdown.length > 30000) throw new Error('Ghi chú quá dài.');
const app = getFirebaseApp();
const auth = getAuth(app);
await auth.authStateReady();
const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
await setDoc(doc(getFirestore(app), 'users', user.uid, 'notes', id), {
title, markdown, updatedAt: serverTimestamp()
});
}
