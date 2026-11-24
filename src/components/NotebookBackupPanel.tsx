import { useEffect, useRef, useState } from 'react';
import type { Notebook } from '../notebook';
import { exportNotebookBackup, importNotebookBackup, MAX_BACKUP_BYTES, parseNotebookBackup, type NotebookBackup } from '../notebook-backup';

export function NotebookBackupPanel({ notebookKey, disabled, onImported }: {
  notebookKey: string; disabled: boolean; onImported: (book: Notebook) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [incoming, setIncoming] = useState<NotebookBackup | null>(null);
  const active = useRef(true), fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function download() {
    if (busy || disabled) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const blob = await exportNotebookBackup(notebookKey);
      if (!active.current) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `mathfolio-notebook-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Backup download started. Keep this private file somewhere safe.');
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Could not export the notebook.'); }
    finally { if (active.current) setBusy(false); }
  }
  async function read(file?: File) {
    if (!file || busy || disabled) return;
    setBusy(true); setError(''); setStatus(''); setIncoming(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 256 MB.');
      const backup = parseNotebookBackup(await file.text());
      if (active.current) setIncoming(backup);
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Could not read this backup.'); }
    finally { if (active.current) setBusy(false); }
  }
  async function restore() {
    if (!incoming || busy || disabled) return;
    setBusy(true); setError('');
    try {
      const book = await importNotebookBackup(notebookKey, incoming, () => active.current);
      if (!active.current) return;
      onImported(book); setIncoming(null); setStatus('Backup imported into your exercise library. Your open workspace was kept.');
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Could not import the backup. Your notebook was kept.'); }
    finally { if (active.current) setBusy(false); }
  }
  return <section className="cloud-sync-panel notebook-backup-panel" aria-labelledby="notebook-backup-title">
    <h2 id="notebook-backup-title">Notebook backup</h2>
    <p>Download saved exercises, folders, notes, chat and images to keep them or move to another Mathfolio website or Firebase project.</p>
    <p className="subtle">Save your workspace exercise first. Unsaved drafts and sign-in details are excluded. This works without Cloud sync.</p>
    <div className="row">
      <button type="button" disabled={disabled || busy} onClick={() => void download()}>Export notebook</button>
      <button type="button" disabled={disabled || busy} onClick={() => fileInput.current?.click()}>Import notebook</button>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Notebook backup file" hidden disabled={disabled || busy}
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void read(file); }}/>
    </div>
    {incoming && <div className="backup-review">
      <p>Import {incoming.notebook.exercises.length} exercises and {incoming.notebook.folders.filter(f => f.id !== 'general').length} folders, including their images?</p>
      <p className="subtle">Adds new copies without replacing existing pages. Importing again creates more copies. If Cloud sync is enabled, imported pages will sync too.</p>
      <div className="row"><button type="button" className="primary" disabled={disabled || busy} onClick={() => void restore()}>Import copies</button><button type="button" disabled={busy} onClick={() => setIncoming(null)}>Cancel import</button></div>
    </div>}
    {busy && <p role="status">Preparing notebook backup…</p>}
    {status && <p role="status">{status}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
