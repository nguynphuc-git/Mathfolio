import { createNotebookCloud, cloudSyncError, type CloudManifest, type NotebookCloud } from './notebook-cloud';
import { entryKey, mergeRemote, normalizeMemberships, notebookEntries, type RemoteEntry } from './notebook-sync-model';
import { observeNotebook, readNotebookState, updateNotebookState } from './notebook-sync-store';

export interface SyncActivity { phase: 'connecting' | 'syncing' | 'synced' | 'error'; error?: string }
export interface NotebookSyncSession { stop(): void; retry(): void }

/** A single serial worker per session; the durable outbox belongs to the account, not the worker. */
export function startNotebookSync(key: string, uid: string, activity: (value: SyncActivity) => void,
  cloud: NotebookCloud = createNotebookCloud(uid)): NotebookSyncSession {
  const controller = new AbortController(), { signal } = controller;
  let stopped = false, running = false, requested = false, serverReady = false;
  let snapshot: CloudManifest[] | null = null, unwatch: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, retryDelay = 1000;
  const current = () => { signal.throwIfAborted(); };
  const report = (value: SyncActivity) => { if (!stopped) activity(value); };
  async function apply(entries: RemoteEntry[], normalize = false) {
    current();
    await updateNotebookState(key, 'remote', state => {
      if (stopped || !state.metadata?.enabled) return state;
      let book = state.book, metadata = state.metadata;
      for (const entry of entries) ({ book, metadata } = mergeRemote(book, metadata, entry));
      return normalize ? normalizeMemberships(book, metadata) : { book, metadata };
    });
  }
  function failure(reason: unknown) {
    if (stopped || (reason as { name?: string })?.name === 'AbortError') return;
    unwatch?.(); unwatch = undefined; serverReady = false; requested = false; snapshot = null;
    report({ phase: 'error', error: cloudSyncError(reason) });
    if (timer) clearTimeout(timer);
    const code = String((reason as { code?: string })?.code ?? '');
    if (/permission-denied|unauthorized|unauthenticated|quota|resource-exhausted|bucket-not-found|project-not-found|no-default-bucket/.test(code)
      || /^(firestore\/)?not-found$/.test(code)
      || /32 MB|unsupported format|invalid identity|could not be read|unexpectedly/.test(reason instanceof Error ? reason.message : '')) return;
    timer = setTimeout(() => { timer = undefined; connect(); request(); }, retryDelay);
    retryDelay = Math.min(300000, retryDelay * 2);
  }
  function connect() {
    if (stopped || unwatch) return;
    report({ phase: 'connecting' });
    try {
      unwatch = cloud.watch(entries => { snapshot = entries; request(); }, reason => {
        unwatch?.(); unwatch = undefined; serverReady = false; failure(reason);
      });
    } catch (reason) { failure(reason); }
  }
  function request() {
    if (stopped) return;
    requested = true;
    if (!running) void run();
  }
  async function run() {
    running = true;
    try {
      while (requested && !stopped) {
        requested = false;
        const incoming = snapshot; snapshot = null;
        if (incoming) {
          report({ phase: 'syncing' });
          // Folder records arrive before pages so their memberships can be normalized together.
          const ordered = incoming.slice().sort((a, b) => a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1);
          for (let offset = 0; offset < ordered.length; offset += 3) {
            current();
            const state = await readNotebookState(key);
            if (!state.metadata?.enabled) return;
            const entries = await Promise.all(ordered.slice(offset, offset + 3).map(async manifest => {
              const id = entryKey(manifest.kind, manifest.id), known = state.metadata!.known[id], pending = state.metadata!.pending[id];
              if (known && manifest.generation < known.generation) return manifest;
              // Own acknowledgements and unchanged bases need no image download.
              if (manifest.deleted || known?.revision === manifest.revision || pending?.revision === manifest.revision
                || pending?.baseRevision === manifest.revision || pending?.ancestors.includes(manifest.revision)) return manifest;
              return cloud.read(manifest, signal);
            }));
            await apply(entries);
          }
          await apply([], true);
          serverReady = true;
        }
        if (!serverReady) continue; // Never push an empty/stale cache over an unread cloud notebook.
        const state = await readNotebookState(key);
        if (!state.metadata?.enabled) return;
        const entries = notebookEntries(state.book);
        const pending = Object.entries(state.metadata.pending);
        if (pending.length) report({ phase: 'syncing' });
        for (const [id, mutation] of pending) {
          current();
          // A save may have replaced this queued version while another page uploaded.
          const latest = await readNotebookState(key);
          if (!latest.metadata?.enabled) return;
          if (latest.metadata.pending[id]?.revision !== mutation.revision) { requested = true; continue; }
          const result = await cloud.write({ ...mutation, value: mutation.deleted ? undefined : entries.get(id)?.value }, signal);
          current();
          if (result.entry) {
            await apply([result.committed ? result.entry : await cloud.read(result.entry, signal)]);
          } else {
            // Server records are tombstoned, never physically deleted by clients.
            throw new Error('The cloud notebook changed unexpectedly. Retry sync before saving to cloud.');
          }
          requested = true;
        }
        const complete = await readNotebookState(key);
        if (complete.metadata?.enabled && !Object.keys(complete.metadata.pending).length && !snapshot) {
          await updateNotebookState(key, 'remote', state => state.metadata?.enabled && !Object.keys(state.metadata.pending).length
            ? { ...state, metadata: { ...state.metadata, lastSyncedAt: new Date().toISOString() } } : state);
          report({ phase: 'synced' }); retryDelay = 1000;
        }
      }
    } catch (reason) { failure(reason); }
    finally { running = false; }
  }
  const unobserve = observeNotebook(key, cause => {
    // Remote writes already schedule their next pass. Local saves remain immediate and offline-safe.
    if (cause !== 'remote') request();
    else void readNotebookState(key).then(state => {
      if (!running && state.metadata?.enabled && Object.keys(state.metadata.pending).length) request();
    }).catch(failure);
  });
  connect();
  return {
    stop() { stopped = true; controller.abort(); unwatch?.(); unobserve(); if (timer) clearTimeout(timer); },
    retry() { if (timer) clearTimeout(timer); timer = undefined; connect(); request(); },
  };
}
