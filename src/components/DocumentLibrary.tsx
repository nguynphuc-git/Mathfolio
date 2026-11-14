import { useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getFirebaseApp } from '../firebase';
import { deleteDocument, listDocuments, openDocument, uploadDocument, type LibraryDocument } from '../library';
import type { Subject } from '../types';
export function DocumentLibrary({ subject, parentBusy, onOpen, onSessionChange }: {
subject: Subject; parentBusy: boolean;
onOpen: (file: File, subject: Subject) => Promise<void>;
onSessionChange: () => void;
}) {
const [enabled, setEnabled] = useState(false);
const [user, setUser] = useState<User | null>(null);
const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
const [docs, setDocs] = useState<LibraryDocument[]>([]);
const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
const [uploadConsent, setUploadConsent] = useState(false);
const [reload, setReload] = useState(0);
const lastUid = useRef<string | null | undefined>(undefined);
useEffect(() => {
if (!enabled) return;
let active = true;
let generation = 0;
try {
const unsubscribe = onAuthStateChanged(getAuth(getFirebaseApp()), next => {
if (!active) return;
const request = ++generation;
setUser(next); setDocs([]);
if (lastUid.current !== (next?.uid ?? null)) { onSessionChange(); lastUid.current = next?.uid ?? null; }
if (next && !next.isAnonymous) {
void listDocuments().then(values => { if (active && request === generation) setDocs(values); }).catch(e => { if (active && request === generation) setMessage(String(e)); });
}
});
return () => { active = false; unsubscribe(); };
} catch (e) { setMessage(String(e)); }
return () => { active = false; };
// onSessionChange only resets the reader; parent callback is intentionally not a dependency.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [enabled, reload]);
async function perform(action: () => Promise<unknown>) {
setBusy(true); setMessage('Đang xử lý / Working…');
try { await action(); setMessage('Hoàn tất / Done.'); }
catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
finally { setPassword(''); setBusy(false); }
}
const disabled = busy || parentBusy;
return <section className="cloud-library"><h2>Thư viện tài liệu cá nhân / Personal document library</h2>
{!enabled ? <button onClick={() => setEnabled(true)}>Kết nối thư viện / Connect library</button> : <>
{!user || user.isAnonymous ? <form onSubmit={e => { e.preventDefault(); void perform(() => signInWithEmailAndPassword(getAuth(getFirebaseApp()), email, password)); }}>
<label>Email<input type="email" required value={email} disabled={disabled} onChange={e => setEmail(e.target.value)} /></label>
<label>Mật khẩu / Password<input type="password" required minLength={6} value={password} disabled={disabled} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
<button disabled={disabled} type="submit">Đăng nhập / Sign in</button>
<button disabled={disabled || !email || password.length < 6} type="button" onClick={() => void perform(() => createUserWithEmailAndPassword(getAuth(getFirebaseApp()), email, password))}>Tạo tài khoản / Register</button>
</form> : <>
<p>{user.email}</p>
<button disabled={disabled} onClick={() => void perform(() => signOut(getAuth(getFirebaseApp())))}>Đăng xuất / Sign out</button>
<button disabled={disabled} onClick={() => setReload(reload + 1)}>Tải lại danh sách / Refresh list</button>
<label><input disabled={disabled} type="checkbox" checked={uploadConsent} onChange={e => setUploadConsent(e.target.checked)} />Tôi đồng ý lưu file gốc lên Firebase Storage. Quyền này khác với cho phép gửi nội dung cho AI cloud. / Allow storing the original file in the cloud.</label>
<label>Tải lên thư viện / Upload to library<input type="file" accept=".pdf,.md,.txt" disabled={disabled || !uploadConsent} onChange={e => {
const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
void perform(async () => { await uploadDocument(file, subject, p => setMessage(`Upload ${Math.round(p)}%`)); setDocs(await listDocuments()); });
}} /></label>
<p>Tối đa 10 MB/file; hiển thị tối đa 50 tài liệu. / Up to 10 MB per file.</p>
{docs.map(entry => <div key={entry.id}><strong>{entry.title}</strong> · {Math.ceil(entry.size / 1024)} KB
<button disabled={disabled} onClick={() => void perform(async () => { await onOpen(await openDocument(entry), entry.subject); })}>Mở / Open</button>
<button disabled={disabled} onClick={() => {
if (!window.confirm(`Xóa / Delete ${entry.title}?`)) return;
void perform(async () => { await deleteDocument(entry); setDocs(await listDocuments()); });
}}>Xóa / Delete</button>
</div>)}
</>}
<p role="status">{message}</p>
</>}
<p>Không kết nối thư viện vẫn có thể mở file tại máy. Đăng xuất xóa nội dung đang đọc khỏi giao diện; ghi chú tại máy vẫn cần được xóa riêng nếu dùng máy chung.</p>
</section>;
}
