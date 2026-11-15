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
/** A library note edit must never overwrite other saved fields with a workspace draft. */
export function putExerciseNotes(book: Notebook, id: string, notes: string): Notebook {
  if (notes.length > 30000) throw new Error('Notes can contain up to 30,000 characters.');
  if (!book.exercises.some(exercise => exercise.id === id)) throw new Error('Exercise not found.');
  return { ...book, exercises: book.exercises.map(exercise => exercise.id === id
    ? { ...exercise, notes, updatedAt: new Date().toISOString() } : exercise) };
}
export async function readAttachment(file: File, kind: Attachment['kind']): Promise<Attachment> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Each image must be smaller than 3 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name, data, kind };
}

export function addFolder(book: Notebook, name: string): Notebook {
  const label = name.trim();
  if (!label || label.length > 80) throw new Error('Enter a folder name of 1–80 characters.');
  if (book.folders.some(folder => folder.name.toLocaleLowerCase() === label.toLocaleLowerCase())) throw new Error('A folder with this name already exists.');
  return { ...book, folders: [...book.folders, { id: crypto.randomUUID(), name: label }] };
}
/** Deleting a folder never deletes pages. The default folder is the recovery destination. */
export function removeFolder(book: Notebook, id: string): Notebook {
  if (id === 'general') throw new Error('The default folder cannot be deleted.');
  if (!book.folders.some(folder => folder.id === id)) throw new Error('Folder not found.');
  return {
    folders: book.folders.filter(folder => folder.id !== id),
    exercises: book.exercises.map(exercise => exercise.folderId === id ? { ...exercise, folderId: 'general' } : exercise)
  };
}
