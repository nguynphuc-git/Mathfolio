import { isFolderColor } from './folder-colors';
import { parseProofScene } from './geometry-proof';
import { exerciseFolderIds, type Notebook } from './notebook';
import { recordChanges } from './notebook-sync-model';
import { readNotebookState, updateNotebookState } from './notebook-sync-store';

export const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
export interface NotebookBackup {
  format: 'mathfolio-notebook'; version: 1; exportedAt: string; notebook: Notebook;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const id = (v: unknown): v is string => text(v) && /^[a-zA-Z0-9_-]{1,200}$/.test(v);
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const list = (v: unknown, check: (v: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.every(check);
const image = (v: unknown) => record(v) && id(v.id) && text(v.name) && text(v.data)
  && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(v.data);
const answer = (v: unknown) => record(v) && text(v.text) && text(v.source);
const latex = (v: unknown) => v === 'latex';
const boolean = (v: unknown) => typeof v === 'boolean';
function exercise(v: unknown): boolean {
  if (!record(v) || !id(v.id) || !text(v.title) || !text(v.statement) || !text(v.notes)
    || !id(v.folderId) || !date(v.updatedAt) || !boolean(v.completed) || !boolean(v.confirmed)
    || !optional(v.folderIds, ids => list(ids, id))
    || !optional(v.subject, s => ['calculus', 'discrete', 'algorithms'].includes(String(s)))
    || !optional(v.statementFormat, latex) || !optional(v.notesFormat, latex)
    || !optional(v.knowledge, answer)
    || !list(v.hints, h => answer(h) && record(h) && optional(h.level, l => l === 1 || l === 2 || l === 3))
    || !list(v.attachments, a => image(a) && record(a) && ['problem', 'solution'].includes(String(a.kind)) && optional(a.useForAI, boolean))
    || !optional(v.chatDraftImages, images => list(images, image))
    || !list(v.messages, m => record(m) && ['user', 'assistant'].includes(String(m.role)) && text(m.text)
      && optional(m.source, text) && optional(m.format, latex) && optional(m.images, images => list(images, image)))) return false;
  if (v.proofDiagram !== undefined) {
    const diagram = v.proofDiagram;
    if (!record(diagram) || !text(diagram.statement) || !text(diagram.source) || !boolean(diagram.showAuxiliary)) return false;
    try { parseProofScene(JSON.stringify(diagram.scene)); } catch { return false; }
  }
  if (v.geometryDiagram !== undefined) {
    const diagram = v.geometryDiagram;
    if (!record(diagram) || !['triangle', 'quadrilateral', 'rectangle', 'trapezoid', 'circle', 'prism', 'pyramid', 'cylinder', 'cone', 'sphere'].includes(String(diagram.figure))
      || !list(diagram.vertices, text) || !list(diagram.givens, text)
      || !list(diagram.strokes, s => record(s) && id(s.id) && ['pen', 'line', 'label'].includes(String(s.tool)) && text(s.color)
        && optional(s.text, text) && list(s.points, p => record(p) && typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)))) return false;
  }
  return true;
}
function validNotebook(value: unknown): value is Notebook {
  if (!record(value) || !list(value.folders, f => record(f) && id(f.id) && text(f.name) && !!f.name.trim() && optional(f.color, isFolderColor))
    || !list(value.exercises, exercise)) return false;
  const book = value as unknown as Notebook;
  const folders = new Set(book.folders.map(f => f.id));
  return folders.has('general') && folders.size === book.folders.length
    && new Set(book.exercises.map(e => e.id)).size === book.exercises.length
    && book.exercises.every(e => folders.has(e.folderId) && exerciseFolderIds(e).every(folder => folders.has(folder)));
}
export function parseNotebookBackup(raw: string): NotebookBackup {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('This file is not valid JSON. Choose a Mathfolio notebook backup.'); }
  if (!record(value) || value.format !== 'mathfolio-notebook' || value.version !== 1 || !date(value.exportedAt) || !validNotebook(value.notebook)) {
    throw new Error('This backup is incomplete or uses an unsupported format. Your notebook was kept.');
  }
  return value as unknown as NotebookBackup;
}
/** The file contains saved content and embedded images, never credentials or sync tokens. */
export async function exportNotebookBackup(key: string): Promise<Blob> {
  const { book } = await readNotebookState(key);
  if (!validNotebook(book)) throw new Error('The notebook could not be exported. Your local data was kept.');
  const blob = new Blob([JSON.stringify({ format: 'mathfolio-notebook', version: 1, exportedAt: new Date().toISOString(), notebook: book })], { type: 'application/json' });
  if (blob.size > MAX_BACKUP_BYTES) throw new Error('This notebook exceeds the 256 MB backup limit.');
  return blob;
}
/** Fresh IDs preserve both notebooks and keep imports independent of old project/UIDs. */
export function mergeNotebookBackup(current: Notebook, incoming: Notebook): Notebook {
  const used = new Set([...current.folders, ...current.exercises].map(item => item.id));
  const fresh = () => { let value: string; do { value = crypto.randomUUID(); } while (used.has(value)); used.add(value); return value; };
  const folderIds = new Map([['general', 'general']]);
  const folders = incoming.folders.filter(f => f.id !== 'general').map(f => {
    const value = fresh(); folderIds.set(f.id, value); return { ...f, id: value };
  });
  const exercises = structuredClone(incoming.exercises).map(e => ({
    ...e, id: fresh(), folderId: folderIds.get(e.folderId)!,
    ...(e.folderIds ? { folderIds: e.folderIds.map(id => folderIds.get(id)!) } : {}),
  }));
  return { folders: [...current.folders, ...folders], exercises: [...current.exercises, ...exercises] };
}
export async function importNotebookBackup(key: string, backup: NotebookBackup, isActive = () => true): Promise<Notebook> {
  if (!validNotebook(backup.notebook)) throw new Error('This backup is incomplete. Your notebook was kept.');
  return (await updateNotebookState(key, 'local', current => {
    if (!isActive()) throw new Error('The notebook changed. Sign in and import the file again.');
    const book = mergeNotebookBackup(current.book, backup.notebook);
    return { book, metadata: current.metadata ? recordChanges(current.book, book, current.metadata) : null };
  })).book;
}
