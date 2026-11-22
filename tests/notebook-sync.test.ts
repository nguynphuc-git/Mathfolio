import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ values: new Map<string, unknown>(), fail: false }));
vi.mock('idb-keyval', () => ({
  get: async (key: string) => structuredClone(storage.values.get(key)),
  set: async (key: string, value: unknown) => { if (storage.fail) throw new Error('Disk full'); storage.values.set(key, structuredClone(value)); },
  setMany: async (entries: [string, unknown][]) => { if (storage.fail) throw new Error('Disk full'); for (const [key, value] of entries) storage.values.set(key, structuredClone(value)); },
}));
import { emptyNotebook, newExercise, putExercise, saveNotebook, type Exercise, type Notebook } from '../src/notebook';
import { entryKey, mergeRemote, newSyncMetadata, recordChanges, type EntryValue } from '../src/notebook-sync-model';
import { readNotebookState, setNotebookSyncEnabled } from '../src/notebook-sync-store';
import { startNotebookSync, type NotebookSyncSession, type SyncActivity } from '../src/notebook-sync';
import { decodeCloudPage, encodeCloudPage, parseManifest, snapshotPath, type CloudChange, type CloudManifest, type NotebookCloud } from '../src/notebook-cloud';

const page = (id = 'first', notes = 'Original'): Exercise => ({ ...newExercise(), id, title: 'Algebra', statement: '2+3=?', notes,
  attachments: [{ id: 'drawing', name: 'drawing.png', kind: 'problem', useForAI: false, data: 'data:image/png;base64,AA==' }],
  messages: [{ role: 'user', text: 'My question', images: [{ id: 'chat-picture', name: 'chat.png', data: 'data:image/png;base64,AQ==' }] }],
  chatDraftImages: [{ id: 'draft-picture', name: 'draft.png', data: 'data:image/png;base64,Ag==' }],
});
const book = (exercise = page()): Notebook => ({ ...emptyNotebook(), exercises: [exercise] });
const sessions: NotebookSyncSession[] = [];
class FakeCloud implements NotebookCloud {
  records = new Map<string, CloudManifest>(); values = new Map<string, EntryValue>();
  listeners = new Set<(entries: CloudManifest[]) => void>();
  reads = 0; writes = 0; error: Error | null = null; beforeWrite?: () => Promise<void>;
  watch(next: (entries: CloudManifest[]) => void) {
    this.listeners.add(next); queueMicrotask(() => { if (this.listeners.has(next)) next(structuredClone([...this.records.values()])); });
    return () => { this.listeners.delete(next); };
  }
  emit() { const all = structuredClone([...this.records.values()]); for (const listener of this.listeners) queueMicrotask(() => { if (this.listeners.has(listener)) listener(all); }); }
  async read(manifest: CloudManifest) { this.reads++; return { ...manifest, value: this.values.get(manifest.revision) }; }
  async write(change: CloudChange, signal: AbortSignal) {
    this.writes++; if (this.error) throw this.error;
    await this.beforeWrite?.(); signal.throwIfAborted();
    const key = entryKey(change.kind, change.id), previous = this.records.get(key) ?? null;
    if (previous?.revision === change.revision) return { committed: true, entry: previous };
    if ((previous?.revision ?? null) !== change.baseRevision) return { committed: false, entry: previous };
    const entry: CloudManifest = { schema: 1, kind: change.kind, id: change.id, revision: change.revision,
      generation: (previous?.generation ?? 0) + 1, deleted: change.deleted,
      payload: change.kind === 'folder' && !change.deleted ? JSON.stringify(change.value) : '',
      storagePath: change.kind === 'exercise' && !change.deleted ? snapshotPath('alice', change.id, change.revision) : '', previousStoragePath: previous?.storagePath ?? '' };
    if (change.value) this.values.set(change.revision, structuredClone(change.value));
    this.records.set(key, entry); this.emit(); return { committed: true, entry };
  }
}
function start(key: string, cloud: FakeCloud, status = vi.fn()) {
  const session = startNotebookSync(key, 'alice', status, cloud); sessions.push(session); return { session, status };
}
async function synced(key: string) {
  await vi.waitFor(async () => { const state = await readNotebookState(key); expect(state.metadata?.lastSyncedAt).toBeTruthy(); expect(Object.keys(state.metadata!.pending)).toHaveLength(0); });
}
async function edit(key: string, notes: string) {
  const { book: before } = await readNotebookState(key);
  await saveNotebook(key, putExercise(before, { ...before.exercises[0], notes }), before);
}
beforeEach(() => { storage.values.clear(); storage.fail = false; });
afterEach(() => { for (const session of sessions.splice(0)) session.stop(); });

describe('private durable cloud notebook', () => {
  it('sends no data until explicitly enabled and atomically saves its offline outbox', async () => {
    await saveNotebook('alice', book());
    expect((await readNotebookState('alice')).metadata).toBeNull();
    await setNotebookSyncEnabled('alice', true);
    const initial = await readNotebookState('alice');
    expect(Object.keys(initial.metadata!.pending)).toHaveLength(1);
    await edit('alice', 'Offline notes');
    const queued = await readNotebookState('alice');
    expect(queued.book.exercises[0].notes).toBe('Offline notes');
    expect(queued.metadata!.pending[entryKey('exercise', 'first')].ancestors).toHaveLength(1);
    storage.fail = true;
    await expect(edit('alice', 'Failed write')).rejects.toThrow('Disk full');
    expect(await readNotebookState('alice')).toEqual(queued);
  });
  it('merges the existing cloud library with local pages and preserves all image locations', async () => {
    const cloud = new FakeCloud();
    await saveNotebook('deviceA', book()); await setNotebookSyncEnabled('deviceA', true); start('deviceA', cloud); await synced('deviceA');
    await saveNotebook('deviceB', book(page('second', 'Other device'))); await setNotebookSyncEnabled('deviceB', true); start('deviceB', cloud);
    await synced('deviceB');
    await vi.waitFor(async () => expect((await readNotebookState('deviceA')).book.exercises).toHaveLength(2));
    const saved = (await readNotebookState('deviceB')).book.exercises.find(item => item.id === 'first')!;
    expect(saved.attachments).toEqual(page().attachments); expect(saved.messages).toEqual(page().messages); expect(saved.chatDraftImages).toEqual(page().chatDraftImages);
  });
  it('keeps both versions after offline devices edit the same page', async () => {
    const cloud = new FakeCloud();
    await saveNotebook('deviceA', book()); await setNotebookSyncEnabled('deviceA', true); const a = start('deviceA', cloud); await synced('deviceA');
    await setNotebookSyncEnabled('deviceB', true); const b = start('deviceB', cloud); await synced('deviceB');
    b.session.stop(); await edit('deviceB', 'Offline on B'); await edit('deviceA', 'Online on A'); await synced('deviceA');
    start('deviceB', cloud); await synced('deviceB');
    const state = await readNotebookState('deviceB');
    expect(state.book.exercises).toHaveLength(2); expect(state.book.exercises.map(item => item.notes).sort()).toEqual(['Offline on B', 'Online on A']);
    expect(state.book.exercises.find(item => item.notes === 'Offline on B')?.title).toContain('conflict copy');
    expect(state.metadata?.conflicts).toBe(1); expect(a.status).toHaveBeenCalledWith({ phase: 'synced' });
  });
  it('does not resurrect a deleted cloud page on an unchanged offline device', async () => {
    const cloud = new FakeCloud();
    await saveNotebook('A', book()); await setNotebookSyncEnabled('A', true); start('A', cloud); await synced('A');
    await setNotebookSyncEnabled('B', true); const b = start('B', cloud); await synced('B'); b.session.stop();
    const before = (await readNotebookState('A')).book; await saveNotebook('A', { ...before, exercises: [] }, before); await synced('A');
    start('B', cloud); await vi.waitFor(async () => expect((await readNotebookState('B')).book.exercises).toHaveLength(0));
    expect(cloud.records.get(entryKey('exercise', 'first'))?.deleted).toBe(true);
  });
  it('preserves a page edited offline when another device deletes its original', async () => {
    const cloud = new FakeCloud();
    await saveNotebook('A', book()); await setNotebookSyncEnabled('A', true); start('A', cloud); await synced('A');
    await setNotebookSyncEnabled('B', true); const b = start('B', cloud); await synced('B'); b.session.stop(); await edit('B', 'Keep this offline work');
    const before = (await readNotebookState('A')).book; await saveNotebook('A', { ...before, exercises: [] }, before); await synced('A');
    start('B', cloud); await synced('B');
    const local = (await readNotebookState('B')).book.exercises;
    expect(local).toHaveLength(1); expect(local[0].id).not.toBe('first'); expect(local[0].notes).toBe('Keep this offline work');
    expect(cloud.records.get(entryKey('exercise', 'first'))?.deleted).toBe(true);
  });
  it('acknowledges an in-flight version without dropping a newer local save', async () => {
    const cloud = new FakeCloud(); await saveNotebook('A', book()); await setNotebookSyncEnabled('A', true); start('A', cloud); await synced('A');
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    const paused = vi.fn(async () => { await pending; }); cloud.beforeWrite = paused;
    await edit('A', 'First save'); await vi.waitFor(() => expect(paused).toHaveBeenCalled()); await edit('A', 'Second save');
    release(); cloud.beforeWrite = undefined; await synced('A');
    expect((await readNotebookState('A')).book.exercises[0].notes).toBe('Second save');
    expect((await readNotebookState('A')).metadata!.conflicts).toBe(0);
    const manifest = cloud.records.get(entryKey('exercise', 'first'))!;
    expect((cloud.values.get(manifest.revision) as Exercise).notes).toBe('Second save');
  });
  it('retains queued changes through permission errors, pause and restart', async () => {
    const cloud = new FakeCloud(); cloud.error = Object.assign(new Error('Denied'), { code: 'permission-denied' });
    await saveNotebook('A', book()); await setNotebookSyncEnabled('A', true); const running = start('A', cloud);
    await vi.waitFor(() => expect(running.status.mock.calls.some(([status]) => (status as SyncActivity).phase === 'error')).toBe(true));
    running.session.stop(); await setNotebookSyncEnabled('A', false); await edit('A', 'Saved while paused');
    expect((await readNotebookState('A')).metadata!.pending[entryKey('exercise', 'first')]).toBeTruthy();
    cloud.error = null; await setNotebookSyncEnabled('A', true); start('A', cloud); await synced('A');
    expect((cloud.values.get(cloud.records.get(entryKey('exercise', 'first'))!.revision) as Exercise).notes).toBe('Saved while paused');
  });
  it('ignores late results after stopping and isolates accounts', async () => {
    const cloud = new FakeCloud(); let release!: () => void;
    cloud.beforeWrite = () => new Promise(resolve => { release = resolve; });
    await saveNotebook('alice', book()); await setNotebookSyncEnabled('alice', true); const a = start('alice', cloud);
    await vi.waitFor(() => expect(cloud.writes).toBe(1)); a.session.stop(); release();
    await saveNotebook('bob', book(page('bob-page', 'Private to Bob')));
    expect((await readNotebookState('bob')).metadata).toBeNull(); expect((await readNotebookState('alice')).metadata!.pending).not.toEqual({});
    expect(cloud.listeners.size).toBe(0);
  });
  it('merges a stale local save without erasing a concurrent cloud addition', async () => {
    const initial = book(); await saveNotebook('A', initial);
    await saveNotebook('A', { ...initial, exercises: [...initial.exercises, page('cloud-addition')] });
    const result = await saveNotebook('A', putExercise(initial, { ...initial.exercises[0], notes: 'Local change' }), initial);
    expect(result.exercises).toHaveLength(2); expect(result.exercises.find(item => item.id === 'first')?.notes).toBe('Local change');
  });
});

describe('monotonic versions and snapshot validation', () => {
  it('ignores stale server snapshots after an acknowledgement', () => {
    const local = book(); let meta = newSyncMetadata(local);
    const key = entryKey('exercise', 'first'), revision = meta.pending[key].revision;
    ({ metadata: meta } = mergeRemote(local, meta, { kind: 'exercise', id: 'first', revision, generation: 3, deleted: false }));
    const stale = mergeRemote(local, meta, { kind: 'exercise', id: 'first', revision: 'old', generation: 2, deleted: true });
    expect(stale.book).toEqual(local); expect(stale.metadata.known[key].generation).toBe(3);
  });
  it('round-trips Unicode math, notes, chat and all images in one complete snapshot', async () => {
    const original = { ...page(), notes: String.raw`\text{Ghi chú }\frac{1}{3}`, statement: 'Chứng minh 2+3=5' };
    const blob = encodeCloudPage(original);
    expect(decodeCloudPage('exercise', original.id, await blob.arrayBuffer())).toEqual(original);
    expect(() => decodeCloudPage('exercise', 'other-id', new TextEncoder().encode(JSON.stringify(original)).buffer)).toThrow('identity');
  });
  it('rejects cross-account snapshot paths and oversized uploads without truncating local work', () => {
    const manifest: CloudManifest = { schema: 1, kind: 'exercise', id: 'first', revision: 'revision', generation: 1, deleted: false, payload: '', storagePath: snapshotPath('alice', 'first', 'revision'), previousStoragePath: '' };
    expect(parseManifest(manifest, 'alice', entryKey('exercise', 'first'))).toEqual(manifest);
    expect(() => parseManifest(manifest, 'bob')).toThrow('unsupported format');
    expect(() => encodeCloudPage({ ...page(), notes: 'x'.repeat(33 * 1024 * 1024) })).toThrow('32 MB');
  });
  it('stages every newly edited field, including completion and folder colors', () => {
    const original = book(), metadata = newSyncMetadata(original);
    const changed = { ...original, folders: [{ ...original.folders[0], color: 'rose' as const }], exercises: [{ ...original.exercises[0], completed: true }] };
    const next = recordChanges(original, changed, metadata);
    expect(next.pending[entryKey('folder', 'general')].revision).toBeTruthy();
    expect(next.pending[entryKey('exercise', 'first')].revision).not.toBe(metadata.pending[entryKey('exercise', 'first')].revision);
  });
});
