import { get, set } from 'idb-keyval';
export interface Answer { text: string; source: string }
export interface Message { role: 'user' | 'assistant'; text: string; source?: string }
export interface Attachment { id: string; name: string; data: string; kind: 'problem' | 'solution' }
export interface Exercise {
  id: string; title: string; folderId: string; subject: 'calculus' | 'discrete' | 'algorithms';
  statement: string; confirmed: boolean; knowledge?: Answer; hints: Answer[];
  notes: string; messages: Message[]; attachments: Attachment[]; completed: boolean; updatedAt: string;
}
export interface Notebook { folders: { id: string; name: string }[]; exercises: Exercise[] }
export function notebookKey(project: string, uid: string) {
  if (!project || !uid) throw new Error('Cần đăng nhập để mở sổ.');
  return `studylens.notebook.v1:${JSON.stringify([project, uid])}`;
}
export function emptyNotebook(): Notebook { return { folders: [{ id: 'general', name: 'Bài tập của tôi' }], exercises: [] }; }
export function newExercise(): Exercise {
  return { id: crypto.randomUUID(), title: '', folderId: 'general', subject: 'calculus', statement: '', confirmed: false,
    hints: [], notes: '', messages: [], attachments: [], completed: false, updatedAt: new Date().toISOString() };
}
export async function loadNotebook(key: string): Promise<Notebook> { return (await get<Notebook>(key)) ?? emptyNotebook(); }
export async function saveNotebook(key: string, value: Notebook) { await set(key, value); }
export function putExercise(book: Notebook, exercise: Exercise): Notebook {
  if (!exercise.title.trim() || !exercise.statement.trim()) throw new Error('Cần tên bài và đề bài.');
  if (!book.folders.some(f => f.id === exercise.folderId)) throw new Error('Hãy chọn thư mục hợp lệ.');
  const snapshot = structuredClone({ ...exercise, title: exercise.title.trim(), updatedAt: new Date().toISOString() });
  return { ...book, exercises: [snapshot, ...book.exercises.filter(e => e.id !== exercise.id)] };
}
export async function readAttachment(file: File, kind: Attachment['kind']): Promise<Attachment> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Chọn ảnh PNG, JPG hoặc WebP.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Mỗi ảnh tối đa 3 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Không đọc được ảnh.')); reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name, data, kind };
}
