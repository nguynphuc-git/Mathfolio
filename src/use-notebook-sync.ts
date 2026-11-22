import { useEffect, useRef, useState } from 'react';
import type { Notebook } from './notebook';
import { cloudSyncError } from './notebook-cloud';
import { observeNotebook, readNotebookState, setNotebookSyncEnabled } from './notebook-sync-store';
import { startNotebookSync, type NotebookSyncSession, type SyncActivity } from './notebook-sync';

interface SyncView extends SyncActivity { key: string; enabled: boolean; pending: number; conflicts: number; lastSyncedAt?: string; loaded: boolean }
const initial = (key = ''): SyncView => ({ key, enabled: false, pending: 0, conflicts: 0, phase: 'connecting', loaded: false });
export function useNotebookSync(key: string, uid: string | undefined, online: boolean, onNotebook: (book: Notebook) => void) {
  const [view, setView] = useState<SyncView>(initial);
  const [retryToken, setRetryToken] = useState(0);
  const session = useRef<NotebookSyncSession | null>(null);
  const callback = useRef(onNotebook); callback.current = onNotebook;
  const activeKey = useRef(key); activeKey.current = key;
  useEffect(() => {
    setView(initial(key));
    if (!key || !uid) return;
    let active = true;
    const refresh = async () => {
      try {
        const state = await readNotebookState(key);
        if (!active || activeKey.current !== key) return;
        callback.current(state.book);
        setView(previous => ({ ...previous, key, loaded: true, enabled: state.metadata?.enabled ?? false,
          pending: Object.keys(state.metadata?.pending ?? {}).length, conflicts: state.metadata?.conflicts ?? 0,
          lastSyncedAt: state.metadata?.lastSyncedAt }));
      } catch (reason) { if (active) setView(previous => ({ ...previous, loaded: true, phase: 'error', error: cloudSyncError(reason) })); }
    };
    const unsubscribe = observeNotebook(key, () => { void refresh(); });
    void refresh();
    return () => { active = false; unsubscribe(); };
  }, [key, uid]);
  const current = view.key === key ? view : initial(key);
  useEffect(() => {
    if (!key || !uid || !current.enabled || !online) return;
    let active = true;
    try {
      session.current = startNotebookSync(key, uid, activity => {
        if (active && activeKey.current === key) setView(previous => ({ ...previous, ...activity, error: activity.error }));
      });
    } catch (reason) { setView(previous => ({ ...previous, phase: 'error', error: cloudSyncError(reason) })); }
    return () => { active = false; session.current?.stop(); session.current = null; };
  }, [key, uid, current.enabled, online, retryToken]);
  async function setEnabled(enabled: boolean) {
    if (!key || !uid) return;
    try { await setNotebookSyncEnabled(key, enabled); if (!enabled) { session.current?.stop(); session.current = null; } }
    catch (reason) { if (activeKey.current === key) setView(previous => ({ ...previous, phase: 'error', error: cloudSyncError(reason) })); }
  }
  const retry = () => { if (session.current) session.current.retry(); else setRetryToken(value => value + 1); };
  const label = !key ? 'Notebook storage: this device' : !current.enabled ? 'Notebook storage: this device · Cloud sync off'
    : !online ? `Cloud sync: offline${current.pending ? ' · changes waiting' : ''}`
    : current.phase === 'error' ? 'Cloud sync needs attention' : current.phase === 'synced' && !current.pending ? 'Cloud sync: up to date'
    : current.phase === 'connecting' ? 'Cloud sync: connecting…' : 'Cloud sync: syncing…';
  return { ...current, label, setEnabled, retry };
}
