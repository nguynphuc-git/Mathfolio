import { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, getFirestore, limit, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteObject, getBlob, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseApp } from './firebase';
import type { Subject } from './types';
export interface LibraryDocument {
id: string; title: string; storagePath: string; size: number; contentType: string; subject: Subject;
}
function services() {
const app = getFirebaseApp();
const user = getAuth(app).currentUser;
if (!user || user.isAnonymous) throw new Error('Đăng nhập tài khoản email để dùng thư viện.');
if (!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) throw new Error('Thiếu VITE_FIREBASE_STORAGE_BUCKET.');
return { uid: user.uid, db: getFirestore(app), storage: getStorage(app) };
}
export function fileContentType(file: File) {
const ext = file.name.toLowerCase().split('.').at(-1);
const types: Record<string, string> = { pdf: 'application/pdf', md: 'text/markdown', txt: 'text/plain' };
if (!ext || !types[ext]) throw new Error('Chỉ nhận PDF, Markdown hoặc TXT.');
if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('File phải lớn hơn 0 và tối đa 10 MB.');
return types[ext];
}
export async function uploadDocument(file: File, subject: Subject, progress: (percent: number) => void) {
const contentType = fileContentType(file);
const { uid, db, storage } = services();
const id = crypto.randomUUID();
const storagePath = `users/${uid}/documents/${id}/original`;
const location = ref(storage, storagePath);
const task = uploadBytesResumable(location, file, { contentType });
await new Promise<void>((resolve, reject) => {
task.on('state_changed', snapshot => progress(100 * snapshot.bytesTransferred / snapshot.totalBytes), reject, () => resolve());
});
const entry: LibraryDocument = { id, title: file.name.slice(0, 200), storagePath, size: file.size, contentType, subject };
try {
await setDoc(doc(db, 'users', uid, 'documents', id), { ...entry, createdAt: serverTimestamp() });
} catch (error) {
try { await deleteObject(location); }
catch { throw new Error(`Lưu metadata thất bại; có thể còn file ở ${storagePath}. Kiểm tra Storage để dọn file mồ côi.`); }
throw error;
}
return entry;
}
export async function listDocuments(): Promise<LibraryDocument[]> {
const { uid, db } = services();
const snapshot = await getDocs(query(collection(db, 'users', uid, 'documents'), limit(50)));
return snapshot.docs.map(d => d.data() as LibraryDocument).sort((a, b) => a.title.localeCompare(b.title));
}
export async function openDocument(entry: LibraryDocument): Promise<File> {
const { uid, storage } = services();
const expected = `users/${uid}/documents/${entry.id}/original`;
if (entry.storagePath !== expected) throw new Error('Đường dẫn tài liệu không hợp lệ.');
const blob = await getBlob(ref(storage, expected), 10 * 1024 * 1024);
if (getAuth(getFirebaseApp()).currentUser?.uid !== uid) throw new Error('Phiên đăng nhập đã thay đổi. Hãy mở lại tài liệu.');
return new File([blob], entry.title, { type: entry.contentType });
}
export async function deleteDocument(entry: LibraryDocument) {
const { uid, db, storage } = services();
const expected = `users/${uid}/documents/${entry.id}/original`;
if (entry.storagePath !== expected) throw new Error('Đường dẫn tài liệu không hợp lệ.');
try { await deleteObject(ref(storage, expected)); }
catch (error) { if ((error as { code?: string }).code !== 'storage/object-not-found') throw error; }
// If metadata delete fails, retry is safe because object-not-found is handled.
await deleteDoc(doc(db, 'users', uid, 'documents', entry.id));
}
