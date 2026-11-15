import { useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getFirebaseApp } from './firebase';
import { friendlyError, notebookAI, type NotebookRequest } from './ai';
import { MarkdownView } from './components/MarkdownView';
import { emptyNotebook, loadNotebook, newExercise, notebookKey, putExercise, readAttachment, saveNotebook, type Exercise, type Notebook, type Attachment } from './notebook';
import './notebook.css';

const symbols = [ ['x²', 'x^{2}'], ['xⁿ', 'x^{n}'], ['√', '\\sqrt{}'], ['a/b', '\\frac{}{}'], ['∑', '\\sum_{i=1}^{n}'], ['∫', '\\int_{}^{}'], ['lim', '\\lim_{x\\to 0}'], ['∞', '\\infty'], ['≤', '\\leq'], ['≥', '\\geq'], ['≠', '\\neq'], ['∈', '\\in'], ['∀', '\\forall'], ['⇒', '\\Rightarrow'], ['α', '\\alpha'], ['π', '\\pi'] ];
const labels = ['Gợi mở', 'Phương pháp', 'Lời giải đầy đủ'];
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false); const [tab, setTab] = useState<'solve' | 'library' | 'account'>('solve');
  const [book, setBook] = useState<Notebook>(emptyNotebook); const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Exercise>(newExercise); const [dirty, setDirty] = useState(false);
  const [folder, setFolder] = useState<string | null>(null); const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState(''); const [folderId, setFolderId] = useState('general'); const [newFolder, setNewFolder] = useState('');
  const [saving, setSaving] = useState(false); const [busy, setBusy] = useState<NotebookRequest['purpose'] | null>(null);
  const [partial, setPartial] = useState(''); const [question, setQuestion] = useState('');
  const [cloudAllowed, setCloudAllowed] = useState(false); const [chatRoute, setChatRoute] = useState<'local' | 'cloud'>('local');
  const [online, setOnline] = useState(navigator.onLine); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const epoch = useRef(0); const key = useRef(''); const input = useRef<HTMLTextAreaElement>(null);
  const blocked = !!busy || saving;

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);
  useEffect(() => { if (!online) setChatRoute('local'); }, [online]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    try {
      const auth = getAuth(getFirebaseApp());
      const unsubscribe = onAuthStateChanged(auth, next => {
        const version = ++epoch.current;
        key.current = ''; setUser(next); setReady(false); setBook(emptyNotebook()); setDraft(newExercise()); setDirty(false);
        setPartial(''); setBusy(null); setSaving(false); setSaveOpen(false); setError(''); setStatus(''); setQuestion(''); setFolder(null); setCloudAllowed(false); setChatRoute('local');
        if (!next) return;
        const nextKey = notebookKey(auth.app.options.projectId!, next.uid); key.current = nextKey;
        void loadNotebook(nextKey).then(value => {
          if (active && epoch.current === version) { setBook(value); setReady(true); }
        }).catch(() => { if (active && epoch.current === version) setError('Không mở được dữ liệu trên máy. Kiểm tra quyền lưu trữ của trình duyệt rồi tải lại trang.'); });
      });
      return () => { active = false; epoch.current++; unsubscribe(); };
    } catch (e) { setError(friendlyError(e)); }
    return () => { active = false; epoch.current++; };
  }, []);

  useEffect(() => {
    if (!saveOpen) return;
    const previous = documentActiveElement();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); setSaveOpen(false); }
      if (event.key !== 'Tab') return;
      const nodes = [...window.document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled), [role="dialog"] select:not(:disabled)')];
      const first = nodes[0], last = nodes.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.document.addEventListener('keydown', handleKey);
    return () => { window.document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [saveOpen, saving]);
  function documentActiveElement() { return window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined; }

  function edit(update: Partial<Exercise>) { setDraft(value => ({ ...value, ...update })); setDirty(true); }
  function changeExercise(value: Exercise) {
    if (dirty && !window.confirm('Bài hiện tại chưa lưu. Bỏ thay đổi để mở bài khác?')) return;
    epoch.current++; setDraft(structuredClone(value)); setDirty(false); setPartial(''); setBusy(null); setError(''); setStatus(''); setQuestion(''); setTab('solve');
  }
  async function authenticate(register: boolean) {
    setAuthBusy(true); setError('');
    try {
      const auth = getAuth(getFirebaseApp());
      if (register) await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
      setTab('solve');
    } catch (e) { setError(friendlyError(e)); }
    finally { setAuthBusy(false); setPassword(''); }
  }
  async function logout() {
    if (dirty && !window.confirm('Bài chưa lưu. Đăng xuất và bỏ thay đổi?')) return;
    setAuthBusy(true); setError('');
    try { await signOut(getAuth(getFirebaseApp())); } catch (e) { setError(friendlyError(e)); }
    finally { setAuthBusy(false); }
  }
  async function ask(purpose: NotebookRequest['purpose']) {
    if (!ready || blocked) return;
    const version = epoch.current; const id = draft.id; const askedQuestion = question.trim();
    if (purpose !== 'knowledge' && !draft.confirmed) { setError('Xác nhận đề trước khi dùng trợ giúp.'); return; }
    if (purpose === 'chat' && !askedQuestion) return;
    if (purpose === 'hint2' && draft.hints.length < 1 || purpose === 'hint3' && draft.hints.length < 2) return;
    setBusy(purpose); setPartial(''); setError(''); setStatus('Đang chờ AI…');
    if (purpose === 'knowledge') edit({ confirmed: true });
    try {
      const answer = await notebookAI({ purpose, statement: draft.statement, subject: draft.subject, knowledge: draft.knowledge?.text ?? '', hints: draft.hints.map(h => h.text), messages: draft.messages, question: askedQuestion, cloudAllowed, route: chatRoute }, text => {
        if (version === epoch.current) { setPartial(text); setStatus('AI đang trả lời…'); }
      });
      if (version !== epoch.current) return;
      setDraft(current => {
        if (current.id !== id) return current;
        if (purpose === 'knowledge') return { ...current, confirmed: true, knowledge: answer };
        if (purpose === 'chat') return { ...current, messages: [...current.messages, { role: 'user', text: askedQuestion }, { role: 'assistant', text: answer.text, source: answer.source }] };
        return { ...current, hints: [...current.hints, answer] };
      });
      setDirty(true); if (purpose === 'chat') setQuestion(''); setStatus('Đã nhận trả lời. Bạn có thể lưu vào sổ.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) { setPartial(''); setBusy(null); } }
  }
  async function attach(file: File | undefined, kind: Attachment['kind']) {
    if (!file || blocked) return;
    const version = epoch.current;
    try {
      if (draft.attachments.length >= 4) throw new Error('Mỗi bài tối đa 4 ảnh.');
      const attachment = await readAttachment(file, kind);
      if (version !== epoch.current) return;
      setDraft(current => {
        if (current.attachments.length >= 4) return current;
        return { ...current, attachments: [...current.attachments, attachment] };
      }); setDirty(true);
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
  }
  function insertMath(latex: string) {
    const element = input.current; if (!element) return;
    const start = element.selectionStart, end = element.selectionEnd;
    const insertion = `$${latex}$`;
    const value = draft.statement.slice(0, start) + insertion + draft.statement.slice(end);
    if (value.length > 6000) return;
    edit({ statement: value });
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + insertion.length, start + insertion.length); });
  }
  function editStatement() {
    if ((draft.knowledge || draft.hints.length || draft.messages.length) && !window.confirm('Sửa đề sẽ xóa kiến thức, hint và chat cũ để tránh lẫn bài. Ghi chú và ảnh vẫn giữ.')) return;
    edit({ confirmed: false, knowledge: undefined, hints: [], messages: [] });
  }
  function beginSave() { setTitle(draft.title); setFolderId(draft.folderId); setNewFolder(''); setSaveOpen(true); }
  async function save() {
    const version = epoch.current; const storageKey = key.current;
    if (!storageKey || !ready || blocked) return;
    setSaving(true); setError('');
    try {
      let next = book; let selected = folderId;
      if (newFolder.trim()) {
        if (newFolder.trim().length > 80) throw new Error('Tên thư mục tối đa 80 ký tự.');
        const existing = book.folders.find(f => f.name.toLocaleLowerCase() === newFolder.trim().toLocaleLowerCase());
        selected = existing?.id ?? crypto.randomUUID();
        if (!existing) next = { ...book, folders: [...book.folders, { id: selected, name: newFolder.trim() }] };
      }
      next = putExercise(next, { ...draft, title: title.slice(0, 120), folderId: selected });
      await saveNotebook(storageKey, next);
      if (version !== epoch.current) return;
      setBook(next); setDraft(next.exercises[0]); setDirty(false); setSaveOpen(false); setStatus('Đã lưu trên máy.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  async function deleteExercise(id: string) {
    if (!window.confirm('Xóa bài này khỏi sổ trên máy?')) return;
    const version = epoch.current; setSaving(true);
    try {
      const next = { ...book, exercises: book.exercises.filter(e => e.id !== id) };
      await saveNotebook(key.current, next);
      if (version !== epoch.current) return;
      setBook(next); if (draft.id === id) { setDraft(newExercise()); setDirty(false); }
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  function streaming(purpose: NotebookRequest['purpose']) { return busy === purpose ? <div className="live-answer" aria-busy="true">{partial || 'Đang chuẩn bị câu trả lời…'}</div> : null; }
  const shown = folder ? book.exercises.filter(e => e.folderId === folder) : [];
  return <main className="notebook-app">
    <header className="notebook-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('solve'); }}><span className="brand-mark">S</span><span>StudyLens<small>YOUR DIGITAL EXERCISE BOOK</small></span></a>
      <nav aria-label="Điều hướng"><button className={tab === 'solve' ? 'active' : ''} onClick={() => setTab('solve')}>Giải bài tập</button><button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Thư viện bài tập <span>{book.exercises.length}</span></button><button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>{user ? 'Tài khoản' : 'Đăng nhập'}</button></nav>
    </header>
    <div className="connection"><span className={online ? 'dot online' : 'dot'} />{online ? 'Có kết nối mạng' : 'Đang offline'}<span>·</span><span>Sổ lưu trên máy · Chưa đồng bộ cloud</span></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {status && <p role="status" className="notice success">{status}</p>}
    {(!user || tab === 'account') && <section className="account-panel paper">
      <div><p className="eyebrow">MỖI NGƯỜI, MỘT CUỐN SỔ</p><h1>{user ? 'Sổ bài tập của bạn' : 'Bắt đầu trang mới.'}</h1><p>Lưu cách bạn suy nghĩ, không chỉ đáp án.</p></div>
      {user ? <div><p>Đã đăng nhập: <strong>{user.email}</strong></p><p className="subtle">Dữ liệu sổ được tách theo tài khoản và môi trường Firebase trên trình duyệt này.</p><button disabled={authBusy || blocked} onClick={() => void logout()}>Đăng xuất</button></div> : <form onSubmit={e => { e.preventDefault(); void authenticate(false); }}><label>Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={authBusy}/></label><label>Mật khẩu<input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={authBusy}/></label><div className="row"><button className="primary" disabled={authBusy} type="submit">Đăng nhập</button><button type="button" disabled={authBusy || password.length < 6 || !email.includes('@')} onClick={() => void authenticate(true)}>Tạo tài khoản</button></div><p className="subtle">Lần đăng nhập đầu cần dịch vụ Authentication hoặc emulator đang chạy.</p></form>}
    </section>}
    {user && !ready && <p role="status">Đang mở sổ trên máy…</p>}
    {user && ready && tab === 'solve' && <>
      <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN TỰ HỌC</p><h1>{draft.title || 'Một bài tập. Một điều mới.'}</h1><p>Hiểu đề, thử sức, rồi mở gợi ý khi bạn cần.</p></div><div className="row"><button disabled={blocked} onClick={() => changeExercise(newExercise())}>＋ Bài mới</button><button className="primary" disabled={blocked || !draft.confirmed} onClick={beginSave}>Lưu bài tập {dirty ? '•' : ''}</button></div></div>
      <div className="workspace">
        <section className="paper problem"><div className="panel-heading"><span className="step">01</span><h2>Đề bài</h2><span className="tag">CỦA BẠN</span></div>
          <label className="subtle">Môn học<select disabled={blocked || draft.confirmed} value={draft.subject} onChange={e => edit({ subject: e.target.value as Exercise['subject'] })}><option value="calculus">Giải tích</option><option value="discrete">Toán rời rạc</option><option value="algorithms">Thuật toán</option></select></label>
          <textarea ref={input} aria-label="Đề bài" className="statement" value={draft.statement} maxLength={6000} readOnly={draft.confirmed} disabled={blocked} onChange={e => edit({ statement: e.target.value })} placeholder="Nhập đề bài ở đây… Ví dụ: Tìm đạo hàm của $f(x)=x^2$."/>
          {!draft.confirmed && <><p className="subtle">Chèn công thức LaTeX tại vị trí con trỏ</p><div className="math-keys">{symbols.map(([label, latex]) => <button key={label} disabled={blocked} onMouseDown={e => e.preventDefault()} onClick={() => insertMath(latex)} aria-label={`Chèn ${label}`}>{label}</button>)}</div></>}
          {draft.statement && <details className="preview"><summary>Xem đề với công thức</summary><MarkdownView value={draft.statement}/></details>}
          <label className="attachment-button">＋ Đính kèm ảnh đề<input type="file" accept="image/png,image/jpeg,image/webp" disabled={blocked || draft.attachments.length >= 4} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void attach(file, 'problem'); }}/></label><p className="subtle">Ảnh dùng để xem và lưu; nhập nội dung đề bằng text. Chưa tự đọc ảnh.</p>
          <div className="attachments">{draft.attachments.filter(a => a.kind === 'problem').map(a => <figure key={a.id}><a href={a.data} target="_blank" rel="noreferrer"><img src={a.data} alt={a.name}/></a><figcaption>{a.name}<button disabled={blocked} onClick={() => edit({ attachments: draft.attachments.filter(x => x.id !== a.id) })}>Gỡ</button></figcaption></figure>)}</div>
          <div className="row">{draft.confirmed && <button disabled={blocked} onClick={editStatement}>Sửa đề</button>}<button className="primary" disabled={blocked || !draft.statement.trim()} onClick={() => void ask('knowledge')}>{draft.confirmed ? 'Phân tích lại kiến thức' : 'Xác nhận đề & phân tích'}</button></div>
        </section>
        <section className="paper knowledge"><div className="panel-heading"><span className="step">02</span><h2>Hành trang kiến thức</h2></div><p className="subtle">Những khái niệm giúp bạn tự tìm lời giải.</p><span className="source-label">AI tại máy</span>{streaming('knowledge')}{draft.knowledge && busy !== 'knowledge' ? <><MarkdownView value={draft.knowledge.text}/><small className="subtle">Nguồn xử lý: {draft.knowledge.source}</small></> : busy !== 'knowledge' && <div className="empty-panel"><span>∑</span><p>Xác nhận đề để khám phá<br/>kiến thức cần dùng.</p></div>}</section>
        <section className="paper hints"><div className="panel-heading"><span className="step">03</span><h2>Mở một chút, hiểu thêm</h2></div><p className="subtle">Chỉ mở tầng tiếp theo khi bạn cần.</p>{labels.map((label, i) => <div className="hint-tier" key={label}><div className="hint-title"><span className="hint-number">{i + 1}</span><strong>{label}</strong><span className="source-label">{i === 0 ? 'Local' : 'Cloud'}</span></div>{draft.hints[i] ? <><MarkdownView value={draft.hints[i].text}/><small className="subtle">{draft.hints[i].source}</small></> : busy === `hint${i + 1}` ? streaming(`hint${i + 1}` as NotebookRequest['purpose']) : <button disabled={blocked || !draft.confirmed || draft.hints.length !== i || (i > 0 && (!cloudAllowed || !online))} onClick={() => void ask(`hint${i + 1}` as NotebookRequest['purpose'])}>Mở tầng {i + 1}</button>}</div>)}<label className="check"><input type="checkbox" checked={cloudAllowed} disabled={blocked} onChange={e => setCloudAllowed(e.target.checked)}/><span>Cho phép gửi đề và ngữ cảnh bài này tới AI cloud khi mở hint 2–3 hoặc chọn chat Cloud.</span></label>{!online && <p className="subtle">Offline: hint 1 và chat local vẫn có thể dùng nếu mô hình đã sẵn sàng.</p>}</section>
        <section className="paper notes"><div className="panel-heading"><span className="step">04</span><h2>Nét nghĩ của bạn</h2></div><textarea aria-label="Ghi chú" value={draft.notes} disabled={blocked} maxLength={30000} onChange={e => edit({ notes: e.target.value })} placeholder="Viết cách làm, chỗ còn vướng, hoặc điều bạn vừa hiểu…"/><label className="attachment-button">＋ Ảnh bài giải của tôi<input type="file" accept="image/png,image/jpeg,image/webp" disabled={blocked || draft.attachments.length >= 4} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void attach(file, 'solution'); }}/></label><div className="attachments">{draft.attachments.filter(a => a.kind === 'solution').map(a => <figure key={a.id}><a href={a.data} target="_blank" rel="noreferrer"><img src={a.data} alt={a.name}/></a><figcaption>{a.name}<button disabled={blocked} onClick={() => edit({ attachments: draft.attachments.filter(x => x.id !== a.id) })}>Gỡ</button></figcaption></figure>)}</div><label className="check"><input type="checkbox" checked={draft.completed} disabled={blocked} onChange={e => edit({ completed: e.target.checked })}/>Tôi đã hoàn thành bài này</label><p className="subtle">Ghi chú và ảnh chỉ lưu vào sổ khi bạn bấm Lưu bài tập.</p></section>
        <section className="paper discussion"><div className="panel-heading"><span className="step">05</span><h2>Còn một hướng khác?</h2><select aria-label="Nơi xử lý chat" value={chatRoute} disabled={blocked} onChange={e => setChatRoute(e.target.value as 'local' | 'cloud')}><option value="local">AI tại máy</option><option value="cloud" disabled={!online || !cloudAllowed}>AI cloud</option></select></div><p className="subtle">Cùng thảo luận, vẫn để bạn cầm bút. AI nhận đề, kiến thức, hint đã mở và tối đa 6 tin nhắn gần nhất.</p><div className="messages">{!draft.messages.length && <div className="empty-chat">“Nếu dùng một cách khác thì sao?”<small>Hãy bắt đầu từ điều bạn đang nghĩ.</small></div>}{draft.messages.map((m, i) => <div className={`message ${m.role}`} key={i}><small>{m.role === 'user' ? 'Bạn' : `StudyLens · ${m.source ?? 'UNKNOWN'}`}</small><MarkdownView value={m.text}/></div>)}{streaming('chat')}</div><form className="chat-form" onSubmit={e => { e.preventDefault(); void ask('chat'); }}><input aria-label="Câu hỏi thảo luận" maxLength={1000} value={question} disabled={blocked || !draft.confirmed} onChange={e => setQuestion(e.target.value)} placeholder="Nhập câu hỏi hoặc cách giải của bạn…"/><button className="primary" disabled={blocked || !draft.confirmed || !question.trim()} type="submit">Gửi ↗</button></form></section>
      </div><p className="footer-note">AI có thể sai. Kiểm tra giả thiết và từng bước biến đổi; bài làm vẫn là của bạn.</p>
    </>}
    {user && ready && tab === 'library' && <section><div className="page-heading"><div><p className="eyebrow">NHỮNG ĐIỀU ĐÃ HỌC</p><h1>{folder ? book.folders.find(f => f.id === folder)?.name : 'Thư viện bài tập'}</h1><p>Mở lại cách bạn đã nghĩ, tiếp tục từ nơi đã dừng.</p></div><button disabled={blocked} onClick={() => changeExercise(newExercise())}>＋ Bài mới</button></div>{folder ? <><button onClick={() => setFolder(null)}>← Tất cả thư mục</button><div className="exercise-list">{!shown.length && <div className="paper empty-panel">Thư mục này chưa có bài tập.</div>}{shown.map(e => <article className="paper exercise-card" key={e.id}><div><span className={`tag ${e.completed ? 'done' : ''}`}>{e.completed ? 'Đã hoàn thành' : 'Đang làm'}</span><h2>{e.title}</h2><p>{e.statement.slice(0, 150)}</p><small>{new Date(e.updatedAt).toLocaleString('vi-VN')} · {e.hints.length}/3 hint đã mở</small></div><div className="row"><button className="primary" disabled={blocked} onClick={() => changeExercise(e)}>Mở bài</button><button disabled={blocked} onClick={() => void deleteExercise(e.id)}>Xóa</button></div></article>)}</div></> : <div className="folder-grid">{book.folders.map(f => <button className="paper folder-card" key={f.id} onClick={() => setFolder(f.id)}><span aria-hidden="true">▱</span><h2>{f.name}</h2><small>{book.exercises.filter(e => e.folderId === f.id).length} bài tập →</small></button>)}</div>}</section>}
    {saveOpen && <div className="modal-backdrop"><section className="paper save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-title"><p className="eyebrow">GIỮ LẠI TRANG NÀY</p><h2 id="save-title">Lưu vào cuốn sổ của bạn</h2><label>Tên bài tập<input autoFocus required maxLength={120} value={title} disabled={saving} onChange={e => setTitle(e.target.value)}/></label><label>Thư mục<select value={folderId} disabled={saving || !!newFolder.trim()} onChange={e => setFolderId(e.target.value)}>{book.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Hoặc tạo thư mục mới<input maxLength={80} value={newFolder} disabled={saving} onChange={e => setNewFolder(e.target.value)} placeholder="Ví dụ: Đạo hàm tuần 1"/></label><p className="subtle">Đề, kiến thức, hint đã mở, ghi chú, ảnh và chat được lưu trên trình duyệt này. Chưa tự đồng bộ cloud.</p>{error && <p role="alert" className="error">{error}</p>}<div className="row"><button disabled={saving} onClick={() => setSaveOpen(false)}>Để sau</button><button className="primary" disabled={saving || !title.trim()} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu trên máy'}</button></div></section></div>}
  </main>;
}
