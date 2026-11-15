import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getFirebaseApp } from './firebase';
import { friendlyError, notebookAI, type NotebookRequest } from './ai';
import { MarkdownView } from './components/MarkdownView';
import { emptyNotebook, loadNotebook, newExercise, notebookKey, putExercise, readAttachment, saveNotebook, type Exercise, type Notebook, type Attachment } from './notebook';
import { MathInput, type MathInputHandle } from './components/MathInput';
import { statementLatex } from './math-input';
import './notebook.css';

const symbols = [ ['x²', '^{2}'], ['xⁿ', '^{#?}'], ['√', '\\sqrt{#?}'], ['a/b', '\\frac{#?}{#?}'], ['∑', '\\sum_{i=1}^{n}'], ['∫', '\\int_{}^{}'], ['lim', '\\lim_{x\\to 0}'], ['∞', '\\infty'], ['≤', '\\leq'], ['≥', '\\geq'], ['≠', '\\neq'], ['∈', '\\in'], ['∀', '\\forall'], ['⇒', '\\Rightarrow'], ['α', '\\alpha'], ['π', '\\pi'] ];
const labels = ['A starting point', 'The method', 'Full solution'];
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
  const epoch = useRef(0); const key = useRef(''); const input = useRef<MathInputHandle>(null);
  const blocked = !!busy || saving;
  const problemPanel = useRef<HTMLElement>(null);
  const [problemHeight, setProblemHeight] = useState(520);
  useLayoutEffect(() => {
    if (!problemPanel.current) return;
    const observer = new ResizeObserver(entries => setProblemHeight(entries[0].target.getBoundingClientRect().height));
    observer.observe(problemPanel.current);
    return () => observer.disconnect();
  }, [ready, user?.uid, tab]);

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
        }).catch(() => { if (active && epoch.current === version) setError('Could not open local data. Check browser storage permissions and reload.'); });
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
    if (dirty && !window.confirm('This exercise has unsaved changes. Discard them and open another?')) return;
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
    if (dirty && !window.confirm('This exercise is not saved. Sign out and discard changes?')) return;
    setAuthBusy(true); setError('');
    try { await signOut(getAuth(getFirebaseApp())); } catch (e) { setError(friendlyError(e)); }
    finally { setAuthBusy(false); }
  }
  async function ask(purpose: NotebookRequest['purpose']) {
    if (!ready || blocked) return;
    const version = epoch.current; const id = draft.id; const askedQuestion = question.trim();
    if (purpose !== 'knowledge' && !draft.confirmed) { setError('Confirm the problem before asking for help.'); return; }
    if (purpose === 'chat' && !askedQuestion) return;
    if (purpose === 'hint2' && draft.hints.length < 1 || purpose === 'hint3' && draft.hints.length < 2) return;
    setBusy(purpose); setPartial(''); setError(''); setStatus('Waiting for AI…');
    if (purpose === 'knowledge') edit({ confirmed: true });
    try {
      const answer = await notebookAI({ purpose, statement: draft.statement, knowledge: draft.knowledge?.text ?? '', hints: draft.hints.map(h => h.text), messages: draft.messages, question: askedQuestion, cloudAllowed, route: chatRoute }, text => {
        if (version === epoch.current) { setPartial(text); setStatus('AI is answering…'); }
      });
      if (version !== epoch.current) return;
      setDraft(current => {
        if (current.id !== id) return current;
        if (purpose === 'knowledge') return { ...current, confirmed: true, knowledge: answer };
        if (purpose === 'chat') return { ...current, messages: [...current.messages, { role: 'user', text: askedQuestion }, { role: 'assistant', text: answer.text, source: answer.source }] };
        return { ...current, hints: [...current.hints, answer] };
      });
      setDirty(true); if (purpose === 'chat') setQuestion(''); setStatus('Response ready. You can save this page.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) { setPartial(''); setBusy(null); } }
  }
  async function attach(file: File | undefined, kind: Attachment['kind']) {
    if (!file || blocked) return;
    const version = epoch.current;
    try {
      if (draft.attachments.length >= 4) throw new Error('Each exercise supports up to 4 images.');
      const attachment = await readAttachment(file, kind);
      if (version !== epoch.current) return;
      setDraft(current => {
        if (current.attachments.length >= 4) return current;
        return { ...current, attachments: [...current.attachments, attachment] };
      }); setDirty(true);
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
  }
  function insertMath(latex: string) { input.current?.insert(latex); }
  function editStatement() {
    if ((draft.knowledge || draft.hints.length || draft.messages.length) && !window.confirm('Editing the problem clears previous knowledge, hints and chat. Notes and images will stay.')) return;
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
        if (newFolder.trim().length > 80) throw new Error('Folder names can contain up to 80 characters.');
        const existing = book.folders.find(f => f.name.toLocaleLowerCase() === newFolder.trim().toLocaleLowerCase());
        selected = existing?.id ?? crypto.randomUUID();
        if (!existing) next = { ...book, folders: [...book.folders, { id: selected, name: newFolder.trim() }] };
      }
      next = putExercise(next, { ...draft, title: title.slice(0, 120), folderId: selected });
      await saveNotebook(storageKey, next);
      if (version !== epoch.current) return;
      setBook(next); setDraft(next.exercises[0]); setDirty(false); setSaveOpen(false); setStatus('Saved on this device.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  async function deleteExercise(id: string) {
    if (!window.confirm('Delete this exercise from your notebook on this device?')) return;
    const version = epoch.current; setSaving(true);
    try {
      const next = { ...book, exercises: book.exercises.filter(e => e.id !== id) };
      await saveNotebook(key.current, next);
      if (version !== epoch.current) return;
      setBook(next); if (draft.id === id) { setDraft(newExercise()); setDirty(false); }
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  function streaming(purpose: NotebookRequest['purpose']) { return busy === purpose ? <div className="live-answer" aria-busy="true">{partial || 'Preparing an answer…'}</div> : null; }
  const shown = folder ? book.exercises.filter(e => e.folderId === folder) : [];
  return <main className="notebook-app">
    <header className="notebook-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('solve'); }}><span className="brand-mark">S</span><span>StudyLens<small>YOUR DIGITAL EXERCISE BOOK</small></span></a>
      <nav aria-label="Navigation"><button className={tab === 'solve' ? 'active' : ''} onClick={() => setTab('solve')}>Workspace</button><button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Exercise library <span>{book.exercises.length}</span></button><button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>{user ? 'Account' : 'Sign in'}</button></nav>
    </header>
    <div className="connection"><span className={online ? 'dot online' : 'dot'} />{online ? 'Online' : 'Offline'}<span>·</span><span>Saved on this device · Cloud sync not available yet</span></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {status && <p role="status" className="notice success">{status}</p>}
    {(!user || tab === 'account') && <section className="account-panel paper">
      <div><p className="eyebrow">ONE PERSON. ONE NOTEBOOK.</p><h1>{user ? 'Your exercise notebook' : 'Start a new page.'}</h1><p>Keep your thinking, not just the answer.</p></div>
      {user ? <div><p>Signed in: <strong>{user.email}</strong></p><p className="subtle">Your notebook is private to this account and Firebase environment on this browser.</p><button disabled={authBusy || blocked} onClick={() => void logout()}>Sign out</button></div> : <form onSubmit={e => { e.preventDefault(); void authenticate(false); }}><label>Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={authBusy}/></label><label>Password<input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={authBusy}/></label><div className="row"><button className="primary" disabled={authBusy} type="submit">Sign in</button><button type="button" disabled={authBusy || password.length < 6 || !email.includes('@')} onClick={() => void authenticate(true)}>Create account</button></div><p className="subtle">Signing in requires Authentication or a running emulator.</p></form>}
    </section>}
    {user && !ready && <p role="status">Opening your notebook…</p>}
    {user && ready && tab === 'solve' && <>
      <div className="page-heading"><div><p className="eyebrow">YOUR THINKING SPACE</p><h1>{draft.title || 'One problem. One discovery.'}</h1><p>Understand it. Try it. Open a hint when you need one.</p></div><div className="row"><button disabled={blocked} onClick={() => changeExercise(newExercise())}>＋ New exercise</button><button className="primary" disabled={blocked || !draft.confirmed} onClick={beginSave}>Save exercise {dirty ? '•' : ''}</button></div></div>
      <div className="workspace">
        <section ref={problemPanel} className="paper problem"><div className="panel-heading"><span className="step">01</span><h2>Problem</h2><span className="tag">YOUR PROBLEM</span></div>
          <MathInput ref={input} value={statementLatex(draft.statement, draft.statementFormat)} readOnly={draft.confirmed} disabled={blocked} onChange={value => edit({ statement: value, statementFormat: 'latex' })}/>
          {!draft.confirmed && <><p className="subtle">Insert symbols directly into your problem.</p><div className="row input-modes"><button disabled={blocked} onClick={() => input.current?.mode('math')}>Math mode</button><button disabled={blocked} onClick={() => input.current?.mode('text')}>Text mode</button></div><div className="math-keys">{symbols.map(([label, latex]) => <button key={label} disabled={blocked} onMouseDown={e => e.preventDefault()} onClick={() => insertMath(latex)} aria-label={`Chèn ${label}`}>{label}</button>)}</div></>}

          <label className="attachment-button">＋ Attach problem image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={blocked || draft.attachments.length >= 4} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void attach(file, 'problem'); }}/></label><p className="subtle">Images are attachments only. Enter the problem above; automatic image reading is not available yet.</p>
          <div className="attachments">{draft.attachments.filter(a => a.kind === 'problem').map(a => <figure key={a.id}><a href={a.data} target="_blank" rel="noreferrer"><img src={a.data} alt={a.name}/></a><figcaption>{a.name}<button disabled={blocked} onClick={() => edit({ attachments: draft.attachments.filter(x => x.id !== a.id) })}>Remove</button></figcaption></figure>)}</div>
          <div className="row">{draft.confirmed && <button disabled={blocked} onClick={editStatement}>Edit problem</button>}<button className="primary" disabled={blocked || !draft.statement.trim()} onClick={() => void ask('knowledge')}>{draft.confirmed ? 'Refresh knowledge' : 'Confirm & analyze'}</button></div>
        </section>
        <section className="paper knowledge" style={{ '--problem-height': `${problemHeight}px` } as React.CSSProperties}><div className="panel-heading"><span className="step">02</span><h2>What you need</h2></div><p className="subtle">Only the concepts needed for this exact problem.</p><div className="knowledge-scroll" role="region" aria-label="Knowledge for this problem" tabIndex={0}><span className="source-label">On-device AI</span>{streaming('knowledge')}{draft.knowledge && busy !== 'knowledge' ? <><MarkdownView value={draft.knowledge.text}/><small className="subtle">Processed by: {draft.knowledge.source}</small></> : busy !== 'knowledge' && <div className="empty-panel"><span>∑</span><p>Confirm your problem to see<br/>the essentials here.</p></div>}</div></section>
        <section className="paper hints"><div className="panel-heading"><span className="step">03</span><h2>A little help, your way</h2></div><p className="subtle">Open the next level only when you need it.</p>{labels.map((label, i) => <div className="hint-tier" key={label}><div className="hint-title"><span className="hint-number">{i + 1}</span><strong>{label}</strong><span className="source-label">{i === 0 ? 'Local' : 'Cloud'}</span></div>{draft.hints[i] ? <><MarkdownView value={draft.hints[i].text}/><small className="subtle">{draft.hints[i].source}</small></> : busy === `hint${i + 1}` ? streaming(`hint${i + 1}` as NotebookRequest['purpose']) : <button disabled={blocked || !draft.confirmed || draft.hints.length !== i || (i > 0 && (!cloudAllowed || !online))} onClick={() => void ask(`hint${i + 1}` as NotebookRequest['purpose'])}>Open level {i + 1}</button>}</div>)}<label className="check"><input type="checkbox" checked={cloudAllowed} disabled={blocked} onChange={e => setCloudAllowed(e.target.checked)}/><span>Allow this problem and its context to be sent to cloud AI when I open hints 2–3 or choose Cloud chat.</span></label>{!online && <p className="subtle">Offline: hint 1 and local chat can work if the device model is ready.</p>}</section>
        <section className="paper notes"><div className="panel-heading"><span className="step">04</span><h2>Your working notes</h2></div><textarea aria-label="Notes" value={draft.notes} disabled={blocked} maxLength={30000} onChange={e => edit({ notes: e.target.value })} placeholder="Write your approach, questions, or what you just learned…"/><label className="attachment-button">＋ Attach my solution<input type="file" accept="image/png,image/jpeg,image/webp" disabled={blocked || draft.attachments.length >= 4} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void attach(file, 'solution'); }}/></label><div className="attachments">{draft.attachments.filter(a => a.kind === 'solution').map(a => <figure key={a.id}><a href={a.data} target="_blank" rel="noreferrer"><img src={a.data} alt={a.name}/></a><figcaption>{a.name}<button disabled={blocked} onClick={() => edit({ attachments: draft.attachments.filter(x => x.id !== a.id) })}>Remove</button></figcaption></figure>)}</div><label className="check"><input type="checkbox" checked={draft.completed} disabled={blocked} onChange={e => edit({ completed: e.target.checked })}/>I have completed this exercise</label><p className="subtle">Notes and images are stored when you select Save exercise.</p></section>
        <section className="paper discussion"><div className="panel-heading"><span className="step">05</span><h2>Another way to think about it?</h2><select aria-label="Chat processing" value={chatRoute} disabled={blocked} onChange={e => setChatRoute(e.target.value as 'local' | 'cloud')}><option value="local">On-device AI</option><option value="cloud" disabled={!online || !cloudAllowed}>Cloud AI</option></select></div><p className="subtle">Discuss your approach. AI receives the problem, essentials, opened hints and up to 6 recent messages.</p><div className="messages">{!draft.messages.length && <div className="empty-chat">“What if I try a different approach?”<small>Start with what you are thinking.</small></div>}{draft.messages.map((m, i) => <div className={`message ${m.role}`} key={i}><small>{m.role === 'user' ? 'You' : `StudyLens · ${m.source ?? 'UNKNOWN'}`}</small><MarkdownView value={m.text}/></div>)}{streaming('chat')}</div><form className="chat-form" onSubmit={e => { e.preventDefault(); void ask('chat'); }}><input aria-label="Discussion question" maxLength={1000} value={question} disabled={blocked || !draft.confirmed} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question or describe your approach…"/><button className="primary" disabled={blocked || !draft.confirmed || !question.trim()} type="submit">Send ↗</button></form></section>
      </div><p className="footer-note">AI can be wrong. Check assumptions and steps. The work is yours.</p>
    </>}
    {user && ready && tab === 'library' && <section><div className="page-heading"><div><p className="eyebrow">PAGES OF PROGRESS</p><h1>{folder ? book.folders.find(f => f.id === folder)?.name : 'Exercise library'}</h1><p>Revisit your thinking. Continue where you left off.</p></div><button disabled={blocked} onClick={() => changeExercise(newExercise())}>＋ New exercise</button></div>{folder ? <><button onClick={() => setFolder(null)}>← All folders</button><div className="exercise-list">{!shown.length && <div className="paper empty-panel">No exercises in this folder yet.</div>}{shown.map(e => <article className="paper exercise-card" key={e.id}><div><span className={`tag ${e.completed ? 'done' : ''}`}>{e.completed ? 'Completed' : 'In progress'}</span><h2>{e.title}</h2><MathInput value={statementLatex(e.statement, e.statementFormat)} readOnly compact label={`Problem: ${e.title}`}/><small>{new Date(e.updatedAt).toLocaleString('en-GB')} · {e.hints.length}/3 hints opened</small></div><div className="row"><button className="primary" disabled={blocked} onClick={() => changeExercise(e)}>Open exercise</button><button disabled={blocked} onClick={() => void deleteExercise(e.id)}>Delete</button></div></article>)}</div></> : <div className="folder-grid">{book.folders.map(f => <button className="paper folder-card" key={f.id} onClick={() => setFolder(f.id)}><span aria-hidden="true">▱</span><h2>{f.name}</h2><small>{book.exercises.filter(e => e.folderId === f.id).length} exercises →</small></button>)}</div>}</section>}
    {saveOpen && <div className="modal-backdrop"><section className="paper save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-title"><p className="eyebrow">KEEP THIS PAGE</p><h2 id="save-title">Save to your notebook</h2><label>Exercise name<input autoFocus required maxLength={120} value={title} disabled={saving} onChange={e => setTitle(e.target.value)}/></label><label>Folder<select value={folderId} disabled={saving || !!newFolder.trim()} onChange={e => setFolderId(e.target.value)}>{book.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Or create a new folder<input maxLength={80} value={newFolder} disabled={saving} onChange={e => setNewFolder(e.target.value)} placeholder="e.g. Algebra — week 1"/></label><p className="subtle">The problem, essentials, opened hints, notes, images and chat stay on this browser. Cloud sync is not available yet.</p>{error && <p role="alert" className="error">{error}</p>}<div className="row"><button disabled={saving} onClick={() => setSaveOpen(false)}>Not now</button><button className="primary" disabled={saving || !title.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save on this device'}</button></div></section></div>}
  </main>;
}
