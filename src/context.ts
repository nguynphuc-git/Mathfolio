export interface ContextSlice { context: string; page?: number; found: boolean; }
// A bounded, exact-text window; no semantic search and no invented page numbers.
export function contextFor(text: string, excerpt: string): ContextSlice {
const target = excerpt.trim();
if (!target) return { context: '', found: false };
const start = text.indexOf(target);
if (start < 0 || text.indexOf(target, start + 1) >= 0)
return { context: '', found: false };
const marker = [...text.slice(0, start).matchAll(/\[Trang \/ Page (\d+)\]/g)].at(-1);
return {
context: text.slice(Math.max(0, start - 1200), Math.min(text.length, start + target.length + 1200)).slice(0, 6000),
page: marker ? Number(marker[1]) : undefined,
found: true
};
}
