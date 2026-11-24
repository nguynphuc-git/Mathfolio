import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ values: new Map<string, unknown>(), fail: false }));
vi.mock('idb-keyval', () => ({
  get: async (key: string) => structuredClone(storage.values.get(key)),
  set: async (key: string, value: unknown) => { if (storage.fail) throw new Error('Disk full'); storage.values.set(key, structuredClone(value)); },
  setMany: async (entries: [string, unknown][]) => { if (storage.fail) throw new Error('Disk full'); for (const [key, value] of entries) storage.values.set(key, structuredClone(value)); },
}));
import { exportNotebookBackup, importNotebookBackup, parseNotebookBackup } from '../src/notebook-backup';
import { emptyNotebook, newExercise, notebookKey, saveNotebook, type Notebook } from '../src/notebook';
import { readNotebookState, setNotebookSyncEnabled, syncMetadataKey } from '../src/notebook-sync-store';
import { exampleProofScene } from '../src/geometry-proof-examples';
import { geometryExamples } from '../src/geometry';

const oldKey = notebookKey('quota-project', 'old-user'), newKey = notebookKey('personal-project', 'new-user');
function fixture(): Notebook {
  return { folders: [...emptyNotebook().folders, { id: 'algebra', name: 'Đại số', color: 'rose' }, { id: 'geometry', name: 'Geometry', color: 'sky' }], exercises: [{
    ...newExercise(), title: 'Giữ đủ đề và ảnh', statement: String.raw`\text{Question}\quad x^2=4`, statementFormat: 'latex',
    notes: String.raw`\text{My working notes}`, notesFormat: 'latex', folderId: 'algebra', folderIds: ['algebra', 'geometry'], completed: true,
    knowledge: { text: 'Essentials', source: 'cloud' }, hints: [{ text: 'A hint', source: 'on_device', level: 2 }],
    attachments: [{ id: 'illustration', name: 'Đề.png', data: 'data:image/png;base64,AA==', kind: 'problem', useForAI: false }, { id: 'solution', name: 'Solution.webp', data: 'data:image/webp;base64,AQ==', kind: 'solution' }],
    messages: [{ role: 'user', text: String.raw`\text{My question}`, format: 'latex', images: [{ id: 'chat-image', name: 'Chat.jpg', data: 'data:image/jpeg;base64,Ag==' }] }, { role: 'assistant', text: 'Answer', source: 'cloud' }],
    chatDraftImages: [{ id: 'next-message', name: 'Next.png', data: 'data:image/png;base64,Aw==' }],
    proofDiagram: { scene: exampleProofScene(geometryExamples[0].statement)!, statement: geometryExamples[0].statement, source: 'local_construction', showAuxiliary: true },
    geometryDiagram: { figure: 'triangle', vertices: ['A', 'B', 'C'], givens: ['AB=2'], strokes: [] },
  }] };
}
async function backup(book = fixture()) {
  await saveNotebook(oldKey, book);
  return parseNotebookBackup(await (await exportNotebookBackup(oldKey)).text());
}
beforeEach(() => { storage.values.clear(); storage.fail = false; });
afterEach(() => { storage.fail = false; });
describe('portable notebook backups', () => {
  it('round-trips Unicode, text/math modes, all images, hints and diagrams without credentials or sync metadata', async () => {
    const source = fixture(); await saveNotebook(oldKey, source); await setNotebookSyncEnabled(oldKey, true);
    const raw = await (await exportNotebookBackup(oldKey)).text(), restored = parseNotebookBackup(raw);
    expect(restored.notebook).toEqual(source);
    expect(Object.keys(restored).sort()).toEqual(['exportedAt', 'format', 'notebook', 'version']);
    expect(raw).not.toContain('old-user'); expect(raw).not.toContain('quota-project'); expect(raw).not.toContain('pending');
  });
  it('moves across projects and UIDs, preserving existing pages and remapping all folder memberships', async () => {
    const file = await backup(), current = fixture();
    // Deliberately use the same IDs, including the exercise ID.
    current.exercises[0].id = file.notebook.exercises[0].id;
    await saveNotebook(newKey, current);
    const result = await importNotebookBackup(newKey, file), added = result.exercises[1];
    expect(result.exercises[0]).toEqual(current.exercises[0]);
    expect(added.id).not.toBe(current.exercises[0].id);
    expect(added.folderId).not.toBe('algebra');
    expect(added.folderIds).toHaveLength(2);
    expect(added.folderIds?.map(id => result.folders.find(f => f.id === id)?.name)).toEqual(['Đại số', 'Geometry']);
    expect({ ...added, id: file.notebook.exercises[0].id, folderId: 'algebra', folderIds: ['algebra', 'geometry'] }).toEqual(file.notebook.exercises[0]);
    expect((await readNotebookState(oldKey)).book).toEqual(file.notebook);
    expect((await readNotebookState(newKey)).metadata).toBeNull();
  });
  it('imports repeated backups as copies and keeps general-only and legacy single-folder pages readable', async () => {
    const source = fixture(); delete source.exercises[0].folderIds;
    source.exercises.push({ ...newExercise(), title: 'General', statement: '2+3=5' });
    const file = await backup(source);
    await importNotebookBackup(newKey, file);
    const result = await importNotebookBackup(newKey, file);
    expect(result.exercises).toHaveLength(4);
    expect(new Set(result.exercises.map(e => e.id)).size).toBe(4);
    expect(result.exercises[1].folderId).toBe('general');
    expect(result.exercises[0].folderIds).toBeUndefined();
  });
  it('records imported pages in the existing outbox without copying the old account sync state', async () => {
    const file = await backup(); await saveNotebook(newKey, emptyNotebook()); await setNotebookSyncEnabled(newKey, true);
    const result = await importNotebookBackup(newKey, file), state = await readNotebookState(newKey);
    expect(state.metadata?.enabled).toBe(true);
    expect(state.metadata?.pending[`exercise~${result.exercises[0].id}`]).toBeTruthy();
    expect(state.metadata?.pending[`exercise~${file.notebook.exercises[0].id}`]).toBeUndefined();
  });
  it('merges against the current persisted notebook, including a save made after file selection', async () => {
    const file = await backup(); await saveNotebook(newKey, { ...emptyNotebook(), exercises: [{ ...newExercise(), title: 'Saved later', statement: 'x=2' }] });
    const result = await importNotebookBackup(newKey, file);
    expect(result.exercises.map(e => e.title)).toEqual(['Saved later', 'Giữ đủ đề và ảnh']);
  });
  it('keeps notebook and outbox intact on storage failure or an account change while importing', async () => {
    const file = await backup(); await saveNotebook(newKey, emptyNotebook()); await setNotebookSyncEnabled(newKey, true);
    const before = structuredClone(storage.values);
    await expect(importNotebookBackup(newKey, file, () => false)).rejects.toThrow('notebook changed');
    expect(storage.values).toEqual(before);
    storage.fail = true; await expect(importNotebookBackup(newKey, file)).rejects.toThrow('Disk full');
    expect(storage.values).toEqual(before); expect(storage.values.get(syncMetadataKey(newKey))).toBeTruthy();
  });
  it.each(['json', 'version', 'duplicate', 'folder', 'image', 'message', 'diagram', 'date', 'mode'])('rejects malformed %s backups before changing any data', async kind => {
    const file = await backup(), raw = file as any;
    if (kind === 'json') { expect(() => parseNotebookBackup('{')).toThrow('valid JSON'); return; }
    if (kind === 'version') raw.version = 2;
    if (kind === 'duplicate') raw.notebook.exercises.push(raw.notebook.exercises[0]);
    if (kind === 'folder') raw.notebook.exercises[0].folderIds = ['missing'];
    if (kind === 'image') raw.notebook.exercises[0].attachments[0].data = 'https://external.example/private.png';
    if (kind === 'message') raw.notebook.exercises[0].messages[0].images = [null];
    if (kind === 'diagram') raw.notebook.exercises[0].proofDiagram.scene.points = [];
    if (kind === 'date') raw.notebook.exercises[0].updatedAt = 'not a date';
    if (kind === 'mode') raw.notebook.exercises[0].statementFormat = 'html';
    expect(() => parseNotebookBackup(JSON.stringify(raw))).toThrow('incomplete');
    expect(storage.values.has(newKey)).toBe(false);
  });
});
