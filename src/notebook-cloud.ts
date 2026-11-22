import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getBytes, getMetadata, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseApp } from './firebase';
import type { Exercise } from './notebook';
import { entryKey, type EntryKind, type EntryValue, type PendingChange, type RemoteEntry } from './notebook-sync-model';

export const MAX_CLOUD_PAGE_BYTES = 32 * 1024 * 1024;
export interface CloudManifest extends Omit<RemoteEntry, 'value'> {
  schema: 1; payload: string; storagePath: string; previousStoragePath: string;
}
export interface CloudChange extends PendingChange { value?: EntryValue }
export interface NotebookCloud {
  watch(next: (entries: CloudManifest[]) => void, error: (reason: unknown) => void): () => void;
  read(manifest: CloudManifest, signal: AbortSignal): Promise<RemoteEntry>;
  write(change: CloudChange, signal: AbortSignal): Promise<{ committed: boolean; entry: CloudManifest | null }>;
}
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
export const snapshotPath = (uid: string, id: string, revision: string) =>
  `users/${uid}/notebook-snapshots/${encodeURIComponent(id)}/${revision}.json`;

export function parseManifest(value: unknown, uid: string, key?: string): CloudManifest {
  const item = value as CloudManifest;
  if (!item || item.schema !== 1 || !['folder', 'exercise'].includes(item.kind) || !safeId(item.id)
    || !/^[a-zA-Z0-9-]{1,80}$/.test(item.revision) || !Number.isSafeInteger(item.generation) || item.generation < 1
    || typeof item.deleted !== 'boolean' || typeof item.payload !== 'string' || typeof item.storagePath !== 'string'
    || typeof item.previousStoragePath !== 'string' || (key && key !== entryKey(item.kind, item.id))
    || (item.kind === 'exercise' && !item.deleted && item.storagePath !== snapshotPath(uid, item.id, item.revision))
    || (item.previousStoragePath && (!item.previousStoragePath.startsWith(`users/${uid}/notebook-snapshots/${encodeURIComponent(item.id)}/`) || !item.previousStoragePath.endsWith('.json')))
    || (item.kind === 'folder' && item.storagePath) || (item.deleted && (item.storagePath || item.payload))) {
    throw new Error('A cloud page uses an unsupported format. Your local notebook was kept.');
  }
  return item;
}
function parseValue(kind: EntryKind, id: string, raw: string): EntryValue {
  const value = JSON.parse(raw);
  if (!value || value.id !== id) throw new Error('A cloud page has an invalid identity.');
  if (kind === 'folder') {
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new Error('A cloud folder could not be read.');
    return value;
  }
  const image = (raw: unknown) => {
    const item = raw as { id?: unknown; name?: unknown; data?: unknown };
    return item && safeId(item.id) && typeof item.name === 'string' && typeof item.data === 'string'
      && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(item.data);
  };
  const answer = (item: { text?: unknown; source?: unknown }) => item && typeof item.text === 'string' && typeof item.source === 'string';
  if (typeof value.title !== 'string' || typeof value.statement !== 'string' || typeof value.notes !== 'string'
    || typeof value.folderId !== 'string' || typeof value.completed !== 'boolean' || typeof value.confirmed !== 'boolean'
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || !Array.isArray(value.attachments) || !value.attachments.every((item: { kind: string }) => image(item) && ['problem', 'solution'].includes(item.kind))
    || !Array.isArray(value.hints) || !value.hints.every(answer) || (value.knowledge && !answer(value.knowledge))
    || !Array.isArray(value.messages) || !value.messages.every((item: { role: string; text: string; images?: unknown[] }) => item
      && ['user', 'assistant'].includes(item.role) && typeof item.text === 'string' && (!item.images || Array.isArray(item.images) && item.images.every(image)))
    || (value.chatDraftImages && (!Array.isArray(value.chatDraftImages) || !value.chatDraftImages.every(image)))
    || (value.folderIds && (!Array.isArray(value.folderIds) || !value.folderIds.every(safeId)))) {
    throw new Error('A cloud exercise could not be read. Your local copy was kept.');
  }
  return value as Exercise;
}
export function encodeCloudPage(value: EntryValue): Blob {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
  if (blob.size > MAX_CLOUD_PAGE_BYTES) throw new Error('This exercise is larger than the 32 MB cloud limit. Remove some images or split it into smaller exercises; the local copy is safe.');
  return blob;
}
export function decodeCloudPage(kind: EntryKind, id: string, bytes: ArrayBuffer): EntryValue {
  if (bytes.byteLength > MAX_CLOUD_PAGE_BYTES) throw new Error('This cloud page is too large to open.');
  return parseValue(kind, id, new TextDecoder().decode(bytes));
}

export function createNotebookCloud(uid: string): NotebookCloud {
  const app = getFirebaseApp(), database = getFirestore(app), storage = getStorage(app), auth = getAuth(app);
  const pages = collection(database, 'users', uid, 'notebook');
  const current = (signal?: AbortSignal) => {
    signal?.throwIfAborted();
    if (auth.currentUser?.uid !== uid) throw new DOMException('The account changed.', 'AbortError');
    if (!navigator.onLine) throw new Error('Cloud sync is waiting for an internet connection.');
  };
  const upload = async (path: string, value: EntryValue, signal: AbortSignal) => {
    current(signal);
    const blob = encodeCloudPage(value);
    const alreadyUploaded = async () => {
      const metadata = await getMetadata(ref(storage, path)); current(signal);
      if (metadata.size !== blob.size || metadata.contentType !== 'application/json') throw new Error('A cloud snapshot has an unsupported format.');
    };
    try { await alreadyUploaded(); return; }
    catch (reason) { if ((reason as { code?: string })?.code !== 'storage/object-not-found') throw reason; }
    current(signal);
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType: 'application/json', cacheControl: 'private, no-store' });
    const abort = () => { task.cancel(); };
    signal.addEventListener('abort', abort, { once: true });
    try { await task; current(signal); }
    catch (reason) {
      current(signal);
      // Two open tabs can upload the same durable operation. An immutable existing object is success.
      if ((reason as { code?: string })?.code === 'storage/unauthorized') await alreadyUploaded(); else throw reason;
    } finally { signal.removeEventListener('abort', abort); }
  };
  const cleanup = async (path: string, signal: AbortSignal) => {
    if (!path || signal.aborted || auth.currentUser?.uid !== uid) return;
    // Cleanup never turns a successfully committed page into a failed sync.
    await deleteObject(ref(storage, path)).catch(() => {});
  };
  return {
    watch(next, error) {
      current();
      return onSnapshot(pages, { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites || auth.currentUser?.uid !== uid) return;
        try { next(snapshot.docs.map(document => parseManifest(document.data(), uid, document.id))); } catch (reason) { error(reason); }
      }, error);
    },
    async read(manifest, signal) {
      current(signal);
      if (manifest.deleted) return manifest;
      const value = manifest.kind === 'folder' ? parseValue('folder', manifest.id, manifest.payload)
        : decodeCloudPage('exercise', manifest.id, await getBytes(ref(storage, manifest.storagePath), MAX_CLOUD_PAGE_BYTES));
      current(signal);
      return { ...manifest, value };
    },
    async write(change, signal) {
      current(signal);
      const path = !change.deleted && change.kind === 'exercise' ? snapshotPath(uid, change.id, change.revision) : '';
      if (path) await upload(path, change.value!, signal);
      current(signal);
      const target = doc(pages, entryKey(change.kind, change.id));
      const result = await runTransaction(database, async transaction => {
        current(signal);
        const document = await transaction.get(target);
        const previous = document.exists() ? parseManifest(document.data(), uid, document.id) : null;
        if (previous?.revision === change.revision) return { committed: true, entry: previous };
        if ((previous?.revision ?? null) !== change.baseRevision) return { committed: false, entry: previous };
        const entry: CloudManifest = {
          schema: 1, kind: change.kind, id: change.id, revision: change.revision,
          generation: (previous?.generation ?? 0) + 1, deleted: change.deleted,
          payload: !change.deleted && change.kind === 'folder' ? JSON.stringify(change.value) : '',
          storagePath: path, previousStoragePath: previous?.storagePath ?? '',
        };
        current(signal);
        transaction.set(target, { ...entry, updatedAt: serverTimestamp() });
        return { committed: true, entry };
      });
      if (result.committed) await cleanup(result.entry!.previousStoragePath, signal);
      else if (path) await cleanup(path, signal);
      return result;
    },
  };
}

export function cloudSyncError(reason: unknown): string {
  const code = String((reason as { code?: unknown })?.code ?? '');
  if (/permission-denied|unauthorized|unauthenticated/.test(code)) return 'Cloud sync was denied. Check Firestore and Storage rules, sign-in and App Check. Your local notebook is safe.';
  if (/quota|resource-exhausted/.test(code)) return 'Cloud sync has reached the project quota. Changes are kept on this device for retry.';
  if (/bucket-not-found|project-not-found|no-default-bucket/.test(code)) return 'Cloud Storage is not ready. Create the bucket in this Firebase project and check its configuration.';
  if (/^(firestore\/)?not-found$/.test(code)) return 'The cloud database is not ready. Create the default Firestore database in this Firebase project, then retry.';
  if (/object-not-found/.test(code)) return 'A cloud page changed during download. Sync will try again; your local work is safe.';
  if (/retry-limit|unavailable|network|unknown/.test(code)) return 'Cloud sync could not connect. Check the connection, Storage setup and bucket CORS, then retry.';
  return reason instanceof Error ? reason.message : 'Cloud sync failed. Your local notebook is safe; try again.';
}
