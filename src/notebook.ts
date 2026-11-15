import { get, set } from 'idb-keyval';
export interface Answer { text: string; source: string }
export interface Message { role: 'user' | 'assistant'; text: string; source?: string }
export interface Attachment { id: string; name: string; data: string; kind: 'problem' | 'solution' }
export interface Exercise {
  id: string; title: string; folderId: string; subject?: 'calculus' | 'discrete' | 'algorithms';
  statement: string; statementFormat?: 'latex'; confirmed: boolean; knowledge?: Answer; hints: Answer[];
  notes: string; messages: Message[]; attachments: Attachment[]; completed: boolean; updatedAt: string;
}
export interface Notebook { folders: { id: string; name: string }[]; exercises: Exercise[] }
export function notebookKey(project: string, uid: string) {
  if (!project || !uid) throw new Error('Sign in to open your notebook.');
  return `studylens.notebook.v1:${JSON.stringify([project, uid])}`;
}
export function emptyNotebook(): Notebook { return { folders: [{ id: 'general', name: 'My exercises' }], exercises: [] }; }
export function newExercise(): Exercise {
  return { id: crypto.randomUUID(), title: '', folderId: 'general', statement: '', statementFormat: 'latex', confirmed: false,
    hints: [], notes: '', messages: [], attachments: [], completed: false, updatedAt: new Date().toISOString() };
}
export async function loadNotebook(key: string): Promise<Notebook> {
  const book = (await get<Notebook>(key)) ?? emptyNotebook();
  // Translate the previous built-in folder label, preserving user-created names.
  return { ...book, folders: book.folders.map(folder => folder.id === 'general' && folder.name === 'Bài tập của tôi' ? { ...folder, name: 'My exercises' } : folder) };
}
export async function saveNotebook(key: string, value: Notebook) { await set(key, value); }
export function putExercise(book: Notebook, exercise: Exercise): Notebook {
  if (!exercise.title.trim() || !exercise.statement.trim()) throw new Error('Enter an exercise name and problem.');
  if (!book.folders.some(f => f.id === exercise.folderId)) throw new Error('Select a valid folder.');
  const snapshot = structuredClone({ ...exercise, title: exercise.title.trim(), updatedAt: new Date().toISOString() });
  return { ...book, exercises: [snapshot, ...book.exercises.filter(e => e.id !== exercise.id)] };
}
export async function readAttachment(file: File, kind: Attachment['kind']): Promise<Attachment> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Each image must be smaller than 3 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name, data, kind };
}
