import { get, set } from 'idb-keyval';
import type { SavedNote } from './types';
const key = 'studylens.notes.v1';
export async function loadNotes(): Promise<SavedNote[]> {
return (await get<SavedNote[]>(key)) ?? [];
}
export async function persistNotes(notes: SavedNote[]) { await set(key, notes); }
export function downloadMarkdown(markdown: string) {
const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
const link = document.createElement('a'); link.href = url; link.download = 'studylens-note.md';
link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
