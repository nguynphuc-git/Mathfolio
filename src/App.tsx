import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getFirebaseApp } from './firebase';
import { friendlyError, notebookAI, type NotebookRequest } from './ai';
import { MarkdownView } from './components/MarkdownView';
import { addFolder, removeFolder, emptyNotebook, loadNotebook, newExercise, notebookKey, putExercise, putExerciseNotes, readAttachment, saveNotebook, type Exercise, type Notebook, type Attachment } from './notebook';
import { ConfirmDialog, type Confirmation } from './components/ConfirmDialog';
import { ExercisePreview } from './components/ExercisePreview';
import { NotesEditor } from './components/NotesEditor';
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
  const [folderDialog, setFolderDialog] = useState(false); const [folderName, setFolderName] = useState('');
  const [collapsedHints, setCollapsedHints] = useState<number[]>([]);
  const [preview, setPreview] = useState<{ id: string; notes: string } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationResult = useRef<((accepted: boolean) => void) | null>(null);
  const [saving, setSaving] = useState(false); const [busy, setBusy] = useState<NotebookRequest['purpose'] | null>(null);
  const [partial, setPartial] = useState(''); const [question, setQuestion] = useState('');
  const [cloudAllowed, setCloudAllowed] = useState(false); const [chatRoute, setChatRoute] = useState<'local' | 'cloud'>('local');
  const [online, setOnline] = useState(navigator.onLine); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const epoch = useRef(0); const key = useRef(''); const input = useRef<MathInputHandle>(null);
  const activeAI = useRef<{ controller: AbortController; status: string; error: string } | null>(null);
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
        activeAI.current?.controller.abort(); activeAI.current = null;
        const version = ++epoch.current;
        confirmationResult.current?.(false); confirmationResult.current = null; setConfirmation(null);
        key.current = ''; setUser(next); setReady(false); setBook(emptyNotebook()); setDraft(newExercise()); setDirty(false);
        setPartial(''); setBusy(null); setSaving(false); setSaveOpen(false); setFolderDialog(false); setPreview(null); setPreviewError(''); setCollapsedHints([]); setError(''); setStatus(''); setQuestion(''); setFolder(null); setCloudAllowed(false); setChatRoute('local');
        if (!next) return;
        const nextKey = notebookKey(auth.app.options.projectId!, next.uid); key.current = nextKey;
        void loadNotebook(nextKey).then(value => {
          if (active && epoch.current === version) { setBook(value); setReady(true); }
        }).catch(() => { if (active && epoch.current === version) setError('Could not open local data. Check browser storage permissions and reload.'); });
      });
      return () => { active = false; epoch.current++; activeAI.current?.controller.abort(); activeAI.current = null; confirmationResult.current?.(false); confirmationResult.current = null; unsubscribe(); };
    } catch (e) { setError(friendlyError(e)); }
    return () => { active = false; epoch.current++; };
  }, []);

  useEffect(() => {
    if (!saveOpen && !folderDialog) return;
    const previous = documentActiveElement();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); setSaveOpen(false); setFolderDialog(false); }
      if (event.key !== 'Tab') return;
      const nodes = [...window.document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled), [role="dialog"] select:not(:disabled)')];
      const first = nodes[0], last = nodes.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.document.addEventListener('keydown', handleKey);
    return () => { window.document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [saveOpen, folderDialog, saving]);
  function documentActiveElement() { return window.document.activeElement instanceof HTMLElement ? window.document.activeElement : undefined; }

  function edit(update: Partial<Exercise>) { setDraft(value => ({ ...value, ...update })); setDirty(true); }
  function confirmChange(value: Confirmation) {
    return new Promise<boolean>(resolve => { confirmationResult.current?.(false); confirmationResult.current=resolve; setConfirmation(value); });
  }
  function closeConfirmation(accepted: boolean) { confirmationResult.current?.(accepted); confirmationResult.current=null; setConfirmation(null); }
  async function changeExercise(value: Exercise) {
    const version=epoch.current;
    if (dirty && !await confirmChange({title:'Open another exercise?',description:'Your latest workspace changes have not been saved. Opening another page will discard them. The saved exercise will stay unchanged.',action:'Discard & open'})) return false;
    if (version !== epoch.current) return false;
    activeAI.current?.controller.abort(); activeAI.current = null;
    epoch.current++; setCollapsedHints([]); setDraft(structuredClone(value)); setDirty(false); setPartial(''); setBusy(null); setError(''); setStatus(''); setQuestion(''); setTab('solve');
    return true;
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
    const version=epoch.current;
    if (dirty && !await confirmChange({title:'Leave your notebook?',description:'Your latest changes are not saved. Sign out and discard this draft?',action:'Sign out'})) return;
    if (version !== epoch.current) return;
    setAuthBusy(true); setError('');
    try { await signOut(getAuth(getFirebaseApp())); } catch (e) { setError(friendlyError(e)); }
    finally { setAuthBusy(false); }
  }
  async function allowCloud(description = 'Cloud AI can send the current problem, essentials, opened hints and recent conversation to the AI service. Notes and attached images are not sent. Allow cloud for this notebook session? Keep Cloud AI off to use the on-device model.'): Promise<boolean> {
    if (!online) { setError('Cloud AI needs an internet connection. Local AI is still available.'); return false; }
    if (cloudAllowed) return true;
    const version = epoch.current;
    const accepted = await confirmChange({ title:'Allow Cloud AI?', description, action:'Allow Cloud AI', cancel:'Not now' });
    if (!accepted || version !== epoch.current || !navigator.onLine) return false;
    setCloudAllowed(true); return true;
  }
  async function toggleCloud() {
    if (blocked) return;
    if (cloudAllowed) { setCloudAllowed(false); setChatRoute('local'); }
    else await allowCloud();
  }
  async function selectChatRoute(route: 'local' | 'cloud') {
    if (blocked) return;
    if (route === 'local') { setChatRoute('local'); return; }
    if (await allowCloud()) setChatRoute('cloud');
  }
  async function ask(purpose: NotebookRequest['purpose']) {
    if (!ready || blocked || activeAI.current) return;
    const version = epoch.current; const id = draft.id; const askedQuestion = question.trim();
    if (purpose !== 'knowledge' && !draft.confirmed) { setError('Confirm the problem before asking for help.'); return; }
    if (purpose === 'chat' && !askedQuestion) return;
    if (purpose === 'hint2' && draft.hints.length < 1 || purpose === 'hint3' && draft.hints.length < 2) return;
    const requestsCloudChat = purpose === 'chat' && chatRoute === 'cloud';
    const permitted = requestsCloudChat ? await allowCloud() : cloudAllowed && online;
    if (requestsCloudChat && !permitted || version !== epoch.current || activeAI.current) return;
    const operation = { controller: new AbortController(), status, error };
    activeAI.current = operation;
    const currentOperation = () => activeAI.current === operation && version === epoch.current && !operation.controller.signal.aborted;
    setBusy(purpose); setPartial(''); setError(''); setStatus('Waiting for AI…');
    try {
      const route = purpose === 'chat' ? chatRoute
        : purpose !== 'hint1' && permitted ? 'cloud' : 'local';
      const answer = await notebookAI({ purpose, statement: draft.statement, knowledge: draft.knowledge?.text ?? '', hints: draft.hints.map(h => h.text), messages: draft.messages, question: askedQuestion, cloudAllowed: permitted, route }, text => {
        if (currentOperation()) { setPartial(text); setStatus('AI is answering…'); }
      }, operation.controller.signal);
      if (!currentOperation()) return;
      setDraft(current => {
        if (current.id !== id) return current;
        if (purpose === 'knowledge') return { ...current, confirmed: true, knowledge: answer };
        if (purpose === 'chat') return { ...current, messages: [...current.messages, { role: 'user', text: askedQuestion }, { role: 'assistant', text: answer.text, source: answer.source }] };
        return { ...current, hints: [...current.hints, answer] };
      });
      if (purpose.startsWith('hint')) setCollapsedHints(current => current.filter(level => level !== Number(purpose.slice(-1)) - 1));
      setDirty(true); if (purpose === 'chat') setQuestion(''); setStatus('Response ready. You can save this page.');
    } catch (e) { if (currentOperation()) { setError(friendlyError(e)); setStatus(operation.status); } }
    finally { if (currentOperation()) { activeAI.current = null; setPartial(''); setBusy(null); } }
  }
  function stopAI() {
    const operation = activeAI.current; if (!operation) return;
    activeAI.current = null;
    operation.controller.abort();
    setPartial(''); setBusy(null); setStatus(operation.status); setError(operation.error);
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
  async function editStatement() {
    const version=epoch.current;
    if ((draft.knowledge || draft.hints.length || draft.messages.length) && !await confirmChange({title:'Revise this problem?',description:'Knowledge, opened hints and this conversation will be cleared so they match your revised problem. Your notes and attached images will stay.',action:'Edit problem'})) return;
    if (version !== epoch.current) return;
    setCollapsedHints([]);
    edit({ confirmed: false, knowledge: undefined, hints: [], messages: [] });
    requestAnimationFrame(() => input.current?.focus());
  }
  function beginSave(editDetails = false) {
    if (!editDetails && book.exercises.some(exercise => exercise.id === draft.id)) { void save(draft); return; }
    setTitle(draft.title); setFolderId(draft.folderId); setNewFolder(''); setSaveOpen(true);
  }
  async function save(existing?: Exercise) {
    const version = epoch.current; const storageKey = key.current;
    if (!storageKey || !ready || blocked) return;
    setSaving(true); setError('');
    try {
      let next = book; let selected = existing?.folderId ?? folderId;
      if (!existing && newFolder.trim()) {
        if (newFolder.trim().length > 80) throw new Error('Folder names can contain up to 80 characters.');
        const existing = book.folders.find(f => f.name.toLocaleLowerCase() === newFolder.trim().toLocaleLowerCase());
        selected = existing?.id ?? crypto.randomUUID();
        if (!existing) next = { ...book, folders: [...book.folders, { id: selected, name: newFolder.trim() }] };
      }
      next = putExercise(next, { ...(existing ?? draft), title: existing?.title ?? title.slice(0, 120), folderId: selected });
      await saveNotebook(storageKey, next);
      if (version !== epoch.current) return;
      setBook(next); setDraft(next.exercises[0]); setDirty(false); setSaveOpen(false); setStatus('Saved on this device.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  function openPreview(exercise: Exercise) { setPreview({ id: exercise.id, notes: exercise.notes }); setPreviewError(''); }
  async function leavePreview(openWorkspace = false) {
    if (!preview || saving) return;
    const version = epoch.current;
    const exercise = book.exercises.find(value => value.id === preview.id); if (!exercise) return;
    if (preview.notes !== exercise.notes && !await confirmChange({ title:'Leave these note changes?', description:'Your notes in this preview have not been saved. Select Keep working to save them, or discard the note changes and continue.', action:'Discard notes & continue' })) return;
    if (version !== epoch.current) return;
    if (openWorkspace && !await changeExercise(exercise)) return;
    setPreview(null); setPreviewError('');
  }
  async function savePreviewNotes() {
    if (!preview || blocked || !ready) return;
    const version = epoch.current; const storageKey = key.current;
    const original = book.exercises.find(value => value.id === preview.id); if (!original) return;
    setSaving(true); setPreviewError('');
    try {
      const next = putExerciseNotes(book, preview.id, preview.notes);
      await saveNotebook(storageKey, next);
      if (version !== epoch.current) return;
      setBook(next);
      // Preserve any existing workspace edits. Its notes can only follow the library
      // when they still match the previously saved notes.
      setDraft(current => current.id === preview.id && current.notes === original.notes ? { ...current, notes: preview.notes } : current);
    } catch (e) { if (version === epoch.current) setPreviewError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  async function deleteExercise(id: string) {
    const version = epoch.current;
    if (!await confirmChange({title:'Delete this exercise?',description:'This page and its saved attachments will be removed from this device. This cannot be undone.',action:'Delete exercise'})) return;
    if (version !== epoch.current) return;
    setSaving(true);
    try {
      const next = { ...book, exercises: book.exercises.filter(e => e.id !== id) };
      await saveNotebook(key.current, next);
      if (version !== epoch.current) return;
      setBook(next); if (draft.id === id) { setDraft(newExercise()); setDirty(false); }
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  async function createFolder() {
    if (blocked || !ready) return;
    const version=epoch.current; setSaving(true); setError('');
    try {
      const next=addFolder(book, folderName);
      await saveNotebook(key.current,next);
      if (version !== epoch.current) return;
      setBook(next); setFolder(null); setFolderDialog(false); setFolderName(''); setStatus('Folder created on this device.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  async function deleteFolder(id: string) {
    if (blocked || id === 'general') return;
    const version=epoch.current;
    const target=book.folders.find(f => f.id === id); if (!target) return;
    const count=book.exercises.filter(e => e.folderId === id).length;
    if (!await confirmChange({title:`Delete “${target.name}”?`,description:count ? `${count} saved exercise${count === 1 ? '' : 's'} will move to My exercises. Your pages and attachments will not be deleted.` : 'This empty folder will be removed from your notebook.',action:'Delete folder'})) return;
    if (version !== epoch.current) return;
    setSaving(true); setError('');
    try {
      const next=removeFolder(book,id);
      await saveNotebook(key.current,next);
      if (version !== epoch.current) return;
      setBook(next); if (folder === id) setFolder(null);
      setDraft(current => current.folderId === id ? { ...current,folderId:'general' } : current);
      setFolderId(current => current === id ? 'general' : current);
      setStatus('Folder removed. Saved exercises were kept.');
    } catch (e) { if (version === epoch.current) setError(friendlyError(e)); }
    finally { if (version === epoch.current) setSaving(false); }
  }
  function streaming(purpose: NotebookRequest['purpose']) { return busy === purpose ? <div className="ai-progress"><button className="stop-ai" onClick={stopAI}>■ Stop AI</button><div className="live-answer" aria-busy="true">{partial || 'Preparing an answer…'}</div></div> : null; }
  const shown = folder ? book.exercises.filter(e => e.folderId === folder) : [];
  const previewExercise = preview ? book.exercises.find(exercise => exercise.id === preview.id) : undefined;
  const savedDraft = book.exercises.some(exercise => exercise.id === draft.id);
  return <><main className="notebook-app" inert={!!confirmation || !!preview}>
    <header className="notebook-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('solve'); }}><span className="brand-mark">M</span><span>Mathfolio<small>YOUR DIGITAL EXERCISE BOOK</small></span></a>
      <nav aria-label="Navigation"><button className={tab === 'solve' ? 'active' : ''} onClick={() => setTab('solve')}>Workspace</button><button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Exercise library <span>{book.exercises.length}</span></button><button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>{user ? 'Account' : 'Sign in'}</button></nav>
    </header>
    <div className="connection"><span className={online ? 'dot online' : 'dot'} />{online ? 'Online' : 'Offline'}<span>·</span><span>Saved on this device · Cloud sync not available yet</span></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {status && <p role="status" className="notice success">{status}</p>}
    {busy && <div className="ai-toolbar" role="status"><span>AI is working on {busy === 'knowledge' ? 'your essentials' : busy === 'chat' ? 'your conversation' : `hint ${busy.slice(-1)}`}…</span><button className="stop-ai" onClick={stopAI}>■ Stop AI</button></div>}
    {(!user || tab === 'account') && <section className="account-panel paper">
      <div><p className="eyebrow">ONE PERSON. ONE NOTEBOOK.</p><h1>{user ? 'Your exercise notebook' : 'Start a new page.'}</h1><p>Keep your thinking, not just the answer.</p></div>
      {user ? <div><p>Signed in: <strong>{user.email}</strong></p><p className="subtle">Your notebook is private to this account and Firebase environment on this browser.</p><button disabled={authBusy || blocked} onClick={() => void logout()}>Sign out</button></div> : <form onSubmit={e => { e.preventDefault(); void authenticate(false); }}><label>Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={authBusy}/></label><label>Password<input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={authBusy}/></label><div className="row"><button className="primary" disabled={authBusy} type="submit">Sign in</button><button type="button" disabled={authBusy || password.length < 6 || !email.includes('@')} onClick={() => void authenticate(true)}>Create account</button></div><p className="subtle">Signing in requires Authentication or a running emulator.</p></form>}
    </section>}
    {user && !ready && <p role="status">Opening your notebook…</p>}
    {user && ready && tab === 'solve' && <>
      <div className="page-heading"><div><p className="eyebrow">YOUR THINKING SPACE</p><h1>{draft.title || 'One problem. One discovery.'}</h1><p>Understand it. Try it. Open a hint when you need one.</p></div><div className="workspace-actions"><div className="row"><button disabled={blocked} onClick={() => changeExercise(newExercise())}>＋ New exercise</button>{savedDraft && <button disabled={blocked} onClick={() => beginSave(true)}>Rename / move</button>}<button className="primary" disabled={blocked || !draft.statement.trim()} onClick={() => beginSave()}>Save exercise {dirty ? '•' : ''}</button></div><button className="cloud-switch" role="switch" aria-checked={cloudAllowed} aria-label="Cloud AI" disabled={blocked} onClick={() => void toggleCloud()}><span className="switch-track" aria-hidden="true"><span/></span>Cloud AI <strong>{cloudAllowed ? 'On' : 'Off'}</strong></button></div></div>
      <div className="workspace">
        <section ref={problemPanel} className="paper problem"><div className="panel-heading"><span className="step">01</span><h2>Problem</h2><span className="tag">YOUR PROBLEM</span></div>
          <MathInput ref={input} value={statementLatex(draft.statement, draft.statementFormat)} readOnly={draft.confirmed} disabled={blocked} onChange={value => edit({ statement: value, statementFormat: 'latex' })}/>
          {!draft.confirmed && <><p className="subtle">Insert symbols directly into your problem.</p><div className="math-keys">{symbols.map(([label, latex]) => <button key={label} disabled={blocked} onMouseDown={e => e.preventDefault()} onClick={() => insertMath(latex)} aria-label={`Insert ${label}`}>{label}</button>)}</div></>}

          <label className="attachment-button">＋ Attach problem image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={blocked || draft.attachments.length >= 4} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void attach(file, 'problem'); }}/></label><p className="subtle">Images are attachments only. Enter the problem above; automatic image reading is not available yet.</p>
          <div className="attachments">{draft.attachments.filter(a => a.kind === 'problem').map(a => <figure key={a.id}><a href={a.data} target="_blank" rel="noreferrer"><img src={a.data} alt={a.name}/></a><figcaption>{a.name}<button disabled={blocked} onClick={() => edit({ attachments: draft.attachments.filter(x => x.id !== a.id) })}>Remove</button></figcaption></figure>)}</div>
          <div className="row">{draft.confirmed && <button disabled={blocked} onClick={editStatement}>Edit problem</button>}<button className="primary" disabled={blocked || !draft.statement.trim()} onClick={() => void ask('knowledge')}>{draft.confirmed ? 'Refresh knowledge' : 'Confirm & analyze'}</button></div>
        </section>
        <section className="paper knowledge" style={{ '--problem-height': `${problemHeight}px` } as React.CSSProperties}><div className="panel-heading"><span className="step">02</span><h2>What you need</h2></div><p className="subtle">Only the concepts needed for this exact problem.</p><div className="knowledge-scroll" role="region" aria-label="Knowledge for this problem" tabIndex={0}><span className="source-label">{draft.knowledge?.source === 'local_reference' ? 'Verified formula · local' : 'On-device AI'}</span>{streaming('knowledge')}{draft.knowledge && busy !== 'knowledge' ? <><MarkdownView value={draft.knowledge.text}/><small className="subtle">Processed by: {draft.knowledge.source === 'local_reference' ? 'local reference library' : draft.knowledge.source}</small></> : busy !== 'knowledge' && <div className="empty-panel"><span>∑</span><p>Confirm your problem to see<br/>the essentials here.</p></div>}</div></section>
        <section className="paper hints" style={{ '--problem-height': `${problemHeight}px` } as React.CSSProperties}>
          <div className="panel-heading"><span className="step">03</span><h2>A little help, your way</h2></div>
          <p className="subtle">Open the next level only when you need it.</p>
          <div className="hints-scroll" role="region" aria-label="Exercise hints" tabIndex={0}>
          {labels.map((label, i) => <div className="hint-tier" key={label}>
            <div className="hint-title"><span className="hint-number">{i + 1}</span><strong>{label}</strong><span className="source-label">{i > 0 && cloudAllowed && online ? 'Cloud' : 'Local'}</span></div>
            {draft.hints[i] ? <>
              <button className="hint-toggle" aria-expanded={!collapsedHints.includes(i)} aria-controls={`hint-content-${i}`} onClick={() => setCollapsedHints(current => current.includes(i) ? current.filter(level => level !== i) : [...current,i])}>{collapsedHints.includes(i) ? 'Show hint ▾' : 'Hide hint ▴'}</button>
              <div id={`hint-content-${i}`} hidden={collapsedHints.includes(i)}><MarkdownView value={draft.hints[i].text}/><small className="subtle">{draft.hints[i].source}</small></div>
            </> : busy === `hint${i + 1}` ? streaming(`hint${i + 1}` as NotebookRequest['purpose']) : <button disabled={blocked || !draft.confirmed || draft.hints.length !== i} onClick={() => void ask(`hint${i + 1}` as NotebookRequest['purpose'])}>Open level {i + 1}</button>}
          </div>)}
          </div>

          {!online && <p className="subtle">Offline: on-device AI can work if the device model is ready.</p>}
        </section>
        <section className="paper notes"><div className="panel-heading"><span className="step">04</span><h2>Your working notes</h2></div><NotesEditor label="Notes" value={draft.notes} disabled={blocked} onChange={notes => edit({ notes })}/><label className="attachment-button">＋ Attach my solution<input type="file" accept="image/png,image/jpeg,image/webp" disabled={blocked || draft.attachments.length >= 4} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void attach(file, 'solution'); }}/></label><div className="attachments">{draft.attachments.filter(a => a.kind === 'solution').map(a => <figure key={a.id}><a href={a.data} target="_blank" rel="noreferrer"><img src={a.data} alt={a.name}/></a><figcaption>{a.name}<button disabled={blocked} onClick={() => edit({ attachments: draft.attachments.filter(x => x.id !== a.id) })}>Remove</button></figcaption></figure>)}</div><label className="check"><input type="checkbox" checked={draft.completed} disabled={blocked} onChange={e => edit({ completed: e.target.checked })}/>I have completed this exercise</label><p className="subtle">Notes and images are stored when you select Save exercise.</p></section>
        <section className="paper discussion"><div className="panel-heading"><span className="step">05</span><h2>Another way to think about it?</h2><div className="chat-routes" role="group" aria-label="Chat processing"><button type="button" aria-pressed={chatRoute === 'local'} disabled={blocked} onClick={() => void selectChatRoute('local')}>Local AI</button><button type="button" aria-pressed={chatRoute === 'cloud'} disabled={blocked || !online} onClick={() => void selectChatRoute('cloud')}>Cloud AI</button></div></div><p className="subtle">Discuss your approach. AI receives the problem, essentials, opened hints and up to 6 recent messages.</p><div className="messages">{!draft.messages.length && <div className="empty-chat">“What if I try a different approach?”<small>Start with what you are thinking.</small></div>}{draft.messages.map((m, i) => <div className={`message ${m.role}`} key={i}><small>{m.role === 'user' ? 'You' : `Mathfolio · ${m.source ?? 'UNKNOWN'}`}</small><MarkdownView value={m.text}/></div>)}{streaming('chat')}</div><form className="chat-form" onSubmit={e => { e.preventDefault(); void ask('chat'); }}><input aria-label="Discussion question" maxLength={1000} value={question} disabled={blocked || !draft.confirmed} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question or describe your approach…"/><button className="primary" disabled={blocked || !draft.confirmed || !question.trim()} type="submit">Send ↗</button></form></section>
      </div><p className="footer-note">AI can be wrong. Check assumptions and steps. The work is yours.</p>
    </>}
    {user && ready && tab === 'library' && <section><div className="page-heading"><div><p className="eyebrow">PAGES OF PROGRESS</p><h1>{folder ? book.folders.find(f => f.id === folder)?.name : 'Exercise library'}</h1><p>Revisit your thinking. Continue where you left off.</p></div><div className="row"><button disabled={blocked} onClick={() => { setFolderName(''); setError(''); setFolderDialog(true); }}>＋ New folder</button>{folder && folder !== 'general' && <button disabled={blocked} onClick={() => void deleteFolder(folder)}>Delete folder</button>}<button disabled={blocked} onClick={() => changeExercise(newExercise())}>＋ New exercise</button></div></div>{folder ? <><button onClick={() => setFolder(null)}>← All folders</button><div className="exercise-list">{!shown.length && <div className="paper empty-panel">No exercises in this folder yet.</div>}{shown.map(e => <article className="paper exercise-card" key={e.id}><div><span className={`tag ${e.completed ? 'done' : ''}`}>{e.completed ? 'Completed' : 'In progress'}</span><h2>{e.title}</h2><MathInput value={statementLatex(e.statement, e.statementFormat)} readOnly compact label={`Problem: ${e.title}`}/><small>{new Date(e.updatedAt).toLocaleString('en-GB')} · {e.hints.length}/3 hints opened</small></div><div className="row"><button className="primary" disabled={blocked} onClick={() => openPreview(e)}>Open exercise</button><button disabled={blocked} onClick={() => void deleteExercise(e.id)}>Delete</button></div></article>)}</div></> : <div className="folder-grid">{book.folders.map(f => <article className="paper folder-card" key={f.id}><button className="folder-open" disabled={blocked} onClick={() => setFolder(f.id)}><span aria-hidden="true">▱</span><h2>{f.name}</h2><small>{book.exercises.filter(e => e.folderId === f.id).length} exercises →</small></button>{f.id !== 'general' && <button className="folder-delete" disabled={blocked} aria-label={`Delete folder ${f.name}`} onClick={() => void deleteFolder(f.id)}>Delete folder</button>}</article>)}</div>}</section>}
    {folderDialog && <div className="modal-backdrop"><section className="paper save-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-title"><p className="eyebrow">ORGANIZE YOUR THINKING</p><h2 id="folder-title">New folder</h2><form onSubmit={e => { e.preventDefault(); void createFolder(); }}><label>Folder name<input autoFocus required maxLength={80} value={folderName} disabled={saving} onChange={e => setFolderName(e.target.value)} placeholder="e.g. Algebra — week 1"/></label>{error && <p role="alert" className="error">{error}</p>}<div className="row"><button type="button" disabled={saving} onClick={() => setFolderDialog(false)}>Cancel</button><button className="primary" type="submit" disabled={saving || !folderName.trim()}>{saving ? 'Creating…' : 'Create folder'}</button></div></form></section></div>}
    {saveOpen && <div className="modal-backdrop"><section className="paper save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-title"><p className="eyebrow">KEEP THIS PAGE</p><h2 id="save-title">Save to your notebook</h2><label>Exercise name<input autoFocus required maxLength={120} value={title} disabled={saving} onChange={e => setTitle(e.target.value)}/></label><label>Folder<select value={folderId} disabled={saving || !!newFolder.trim()} onChange={e => setFolderId(e.target.value)}>{book.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Or create a new folder<input maxLength={80} value={newFolder} disabled={saving} onChange={e => setNewFolder(e.target.value)} placeholder="e.g. Algebra — week 1"/></label><p className="subtle">The problem, essentials, opened hints, notes, images and chat stay on this browser. Cloud sync is not available yet.</p>{error && <p role="alert" className="error">{error}</p>}<div className="row"><button disabled={saving} onClick={() => setSaveOpen(false)}>Not now</button><button className="primary" disabled={saving || !title.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save on this device'}</button></div></section></div>}
  </main>{preview && previewExercise && <ExercisePreview key={preview.id} exercise={previewExercise} folderName={book.folders.find(value => value.id === previewExercise.folderId)?.name ?? 'My exercises'} notes={preview.notes} saving={saving} suspended={!!confirmation} error={previewError} onNotes={notes => setPreview(current => current ? { ...current, notes } : current)} onSaveNotes={() => void savePreviewNotes()} onClose={() => void leavePreview()} onOpenWorkspace={() => void leavePreview(true)}/>} {confirmation && <ConfirmDialog {...confirmation} onClose={closeConfirmation}/>}</>;
}
