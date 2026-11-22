import { get, set, setMany } from 'idb-keyval';
import { emptyNotebook, type Notebook } from './notebook';
import { mergeLocalSave, newSyncMetadata, recordChanges, type SyncMetadata } from './notebook-sync-model';

export interface LocalNotebookState { book: Notebook; metadata: SyncMetadata | null }
type Cause = 'local' | 'remote' | 'settings';
const queues = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<(cause: Cause) => void>>();
let channel: BroadcastChannel | null = null;
export const syncMetadataKey = (key: string) => `${key}:cloud-sync-v1`;
function connectChannel() {
  if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('mathfolio-notebook-changes-v1');
  channel.onmessage = event => {
    if (typeof event.data?.key === 'string') listeners.get(event.data.key)?.forEach(listener => listener('remote'));
  };
}
function notify(key: string, cause: Cause) {
  listeners.get(key)?.forEach(listener => listener(cause));
  channel?.postMessage({ key });
}
export function observeNotebook(key: string, listener: (cause: Cause) => void): () => void {
  connectChannel();
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => { listeners.get(key)?.delete(listener); if (!listeners.get(key)?.size) listeners.delete(key); };
}
function enqueue<T>(key: string, action: () => Promise<T>): Promise<T> {
  const task = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(() =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(`mathfolio:${key}`, action) : action());
  queues.set(key, task);
  void task.catch(() => {}).finally(() => { if (queues.get(key) === task) queues.delete(key); });
  return task;
}
async function read(key: string): Promise<LocalNotebookState> {
  const [book, metadata] = await Promise.all([get<Notebook>(key), get<SyncMetadata>(syncMetadataKey(key))]);
  if (metadata && metadata.version !== 1) throw new Error('This sync data needs a newer version of Mathfolio.');
  const translated = book ? { ...book, folders: book.folders.map(folder => folder.id === 'general' && folder.name === 'Bài tập của tôi' ? { ...folder, name: 'My exercises' } : folder) } : emptyNotebook();
  return { book: translated, metadata: metadata ?? null };
}
export function readNotebookState(key: string): Promise<LocalNotebookState> { return enqueue(key, () => read(key)); }
export function updateNotebookState(key: string, cause: Cause, update: (value: LocalNotebookState) => LocalNotebookState): Promise<LocalNotebookState> {
  return enqueue(key, async () => {
    const value = update(await read(key));
    // The page and durable outbox commit together; a failed save cannot lose the outbox.
    if (value.metadata) await setMany([[key, value.book], [syncMetadataKey(key), value.metadata]]);
    else await set(key, value.book);
    notify(key, cause);
    return value;
  });
}
export async function persistNotebook(key: string, edited: Notebook, before?: Notebook): Promise<Notebook> {
  return (await updateNotebookState(key, 'local', current => {
    const merged = before ? mergeLocalSave(current.book, before, edited) : { book: edited, conflicts: 0 };
    const metadata = current.metadata ? recordChanges(current.book, merged.book, current.metadata) : null;
    if (metadata) metadata.conflicts += merged.conflicts;
    return { book: merged.book, metadata };
  })).book;
}
export async function setNotebookSyncEnabled(key: string, enabled: boolean): Promise<void> {
  await updateNotebookState(key, 'settings', current => ({ ...current,
    metadata: { ...(current.metadata ?? newSyncMetadata(current.book)), enabled },
  }));
}
