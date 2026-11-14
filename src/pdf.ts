import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export async function extractPdf(file: File): Promise<string> {
if (file.size > 10 * 1024 * 1024) throw new Error('Bản mẫu nhận PDF tối đa 10 MB.');
const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
try {
const pdf = await loadingTask.promise;
if (pdf.numPages > 30) throw new Error('Hãy tách PDF còn tối đa 30 trang cho bản mẫu.');
const pages: string[] = [];
let total = 0;
for (let n = 1; n <= pdf.numPages; n++) {
const page = await pdf.getPage(n);
const content = await page.getTextContent();
let text = '';
for (const item of content.items) {
if ('str' in item) text += item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ');
}
total += text.length;
if (total > 150000) throw new Error('PDF có quá nhiều văn bản; hãy tách thành chương nhỏ.');
pages.push(`[Trang / Page ${n}]\n${text}`);
page.cleanup();
}
if (pages.join('').replace(/\[Trang \/ Page \d+\]/g, '').trim().length < 20)
throw new Error('Không trích xuất được chữ. PDF có thể là bản scan; hãy dán văn bản hoặc nhập LaTeX.');
return pages.join('\n\n');
} finally { await loadingTask.destroy(); }
}
