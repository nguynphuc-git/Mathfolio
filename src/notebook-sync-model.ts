import { emptyNotebook, exerciseFolderIds, type Exercise, type Notebook } from './notebook';

export type Folder = Notebook['folders'][number];
export type EntryKind = 'exercise' | 'folder';
export type EntryValue = Exercise | Folder;
export interface Version { revision: string; generation: number }
export interface PendingChange {
  kind: EntryKind; id: string; revision: string; baseRevision: string | null;
  ancestors: string[]; deleted: boolean;
}
export interface SyncMetadata {
  version: 1; enabled: boolean; known: Record<string, Version>;
  pending: Record<string, PendingChange>; conflicts: number; lastSyncedAt?: string;
}
export interface RemoteEntry extends Version {
  kind: EntryKind; id: string; deleted: boolean; value?: EntryValue;
}
export const entryKey = (kind: EntryKind, id: string) => `${kind}~${encodeURIComponent(id)}`;

/** Ignore object property order and optional undefined values when comparing snapshots. */
export function equivalent(a: unknown, b: unknown): boolean {
  const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, normalized(item)])) : value;
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}
export function notebookEntries(book: Notebook): Map<string, { kind: EntryKind; id: string; value: EntryValue }> {
  return new Map<string, { kind: EntryKind; id: string; value: EntryValue }>([
    ...book.folders.map(value => [entryKey('folder', value.id), { kind: 'folder' as const, id: value.id, value }] as const),
    ...book.exercises.map(value => [entryKey('exercise', value.id), { kind: 'exercise' as const, id: value.id, value }] as const),
  ]);
}
export function newSyncMetadata(book: Notebook): SyncMetadata {
  // A new browser's implicit default folder is not a local edit of a cloud folder.
  return recordChanges(emptyNotebook(), book, { version: 1, enabled: true, known: {}, pending: {}, conflicts: 0 });
}

/** Keep the original cloud base through any number of edits made while offline. */
export function recordChanges(before: Notebook, after: Notebook, metadata: SyncMetadata): SyncMetadata {
  const old = notebookEntries(before), next = notebookEntries(after), pending = { ...metadata.pending };
  for (const key of new Set([...old.keys(), ...next.keys()])) {
    if (equivalent(old.get(key)?.value, next.get(key)?.value)) continue;
    const entry = next.get(key) ?? old.get(key)!;
    const previous = pending[key];
    pending[key] = {
      kind: entry.kind, id: entry.id, revision: crypto.randomUUID(),
      baseRevision: previous ? previous.baseRevision : metadata.known[key]?.revision ?? null,
      ancestors: previous ? [...previous.ancestors, previous.revision] : [], deleted: !next.has(key),
    };
  }
  return { ...metadata, pending };
}
function applyEntry(book: Notebook, kind: EntryKind, id: string, value?: EntryValue): Notebook {
  if (kind === 'folder') return { ...book, folders: [...book.folders.filter(folder => folder.id !== id), ...(value ? [value as Folder] : [])] };
  return { ...book, exercises: [...(value ? [value as Exercise] : []), ...book.exercises.filter(exercise => exercise.id !== id)] };
}
function preserveCopy(book: Notebook, kind: EntryKind, value: EntryValue): Notebook {
  const id = crypto.randomUUID();
  if (kind === 'exercise') {
    const exercise = value as Exercise;
    return applyEntry(book, kind, id, { ...structuredClone(exercise), id,
      title: `${exercise.title.slice(0, 102)} (conflict copy)`, updatedAt: new Date().toISOString() });
  }
  const folder = value as Folder;
  return { ...applyEntry(book, kind, id, { ...folder, id, name: `${folder.name.slice(0, 63)} (conflict copy)` }),
    exercises: book.exercises.map(exercise => exerciseFolderIds(exercise).includes(folder.id)
      ? { ...exercise, folderIds: [...exerciseFolderIds(exercise), id] } : exercise) };
}

/** Three-way merge: cloud generations are monotonic; conflicting local work gets a copy. */
export function mergeRemote(book: Notebook, metadata: SyncMetadata, remote: RemoteEntry): { book: Notebook; metadata: SyncMetadata } {
  const key = entryKey(remote.kind, remote.id), known = metadata.known[key], pending = metadata.pending[key];
  if (known && remote.generation < known.generation) return { book, metadata };
  const next: SyncMetadata = { ...metadata, known: { ...metadata.known, [key]: { revision: remote.revision, generation: remote.generation } }, pending: { ...metadata.pending } };
  if (pending?.revision === remote.revision) {
    delete next.pending[key]; // Acknowledge this exact upload without replacing newer UI state.
    return { book, metadata: next };
  }
  const ancestor = pending?.ancestors.indexOf(remote.revision) ?? -1;
  if (pending && ancestor >= 0) {
    next.pending[key] = { ...pending, baseRevision: remote.revision, ancestors: pending.ancestors.slice(ancestor + 1) };
    return { book, metadata: next };
  }
  if (known?.revision === remote.revision || pending?.baseRevision === remote.revision) return { book, metadata: next };
  const local = notebookEntries(book).get(key)?.value;
  if (!remote.deleted && !remote.value) throw new Error('The cloud page could not be read. Your local copy was kept.');
  if (pending && (pending.deleted === remote.deleted) && (remote.deleted || equivalent(local, remote.value))) {
    delete next.pending[key];
    return { book, metadata: next };
  }
  let merged = applyEntry(book, remote.kind, remote.id, remote.deleted ? undefined : remote.value);
  delete next.pending[key];
  if (pending && !pending.deleted && local) {
    const copied = preserveCopy(merged, remote.kind, local);
    const staged = recordChanges(merged, copied, next);
    staged.conflicts++;
    return { book: copied, metadata: staged };
  }
  if (pending?.deleted && !remote.deleted) next.conflicts++;
  return { book: merged, metadata: next };
}

/** A folder deletion never deletes a page, including pages edited on an offline device. */
export function normalizeMemberships(book: Notebook, metadata: SyncMetadata): { book: Notebook; metadata: SyncMetadata } {
  const folders = book.folders.some(folder => folder.id === 'general') ? book.folders : [...emptyNotebook().folders, ...book.folders];
  const ids = new Set(folders.map(folder => folder.id));
  const normalized = { folders, exercises: book.exercises.map(exercise => {
    const selected = exerciseFolderIds(exercise), valid = selected.filter(id => ids.has(id));
    return selected.length === valid.length ? exercise : { ...exercise, folderIds: valid, folderId: valid[0] ?? 'general' };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  return { book: normalized, metadata: recordChanges(book, normalized, metadata) };
}

/** Apply only the caller's edits to the latest local book, preserving a concurrent pull. */
export function mergeLocalSave(current: Notebook, before: Notebook, edited: Notebook): { book: Notebook; conflicts: number } {
  const old = notebookEntries(before), next = notebookEntries(edited), latest = notebookEntries(current);
  let book = current, conflicts = 0;
  for (const key of new Set([...old.keys(), ...next.keys()])) {
    const original = old.get(key), changed = next.get(key), existing = latest.get(key);
    if (equivalent(original?.value, changed?.value)) continue;
    const entry = changed ?? original!;
    if (!equivalent(existing?.value, original?.value) && !equivalent(existing?.value, changed?.value)) {
      if (changed) book = preserveCopy(book, entry.kind, changed.value);
      conflicts++;
    } else book = applyEntry(book, entry.kind, entry.id, changed?.value);
  }
  return { book, conflicts };
}
