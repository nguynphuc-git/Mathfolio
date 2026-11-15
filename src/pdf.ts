import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfQuestion { page: number; text: string }

export function splitPdfQuestions(pages: { page: number; text: string }[]): PdfQuestion[] {
  const questions: PdfQuestion[] = [];
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const starts = lines.flatMap((line, index) =>
      /^(?:(?:question|problem|exercise)\s+\d{1,3}\s*[:.)]?|\(?\d{1,3}[.)])\s+\S/i.test(line) ? [index] : []);
    const boundaries = starts.length ? starts : [0];
    for (let i = 0; i < boundaries.length; i++) {
      const end = boundaries[i + 1] ?? lines.length;
      const text = lines.slice(boundaries[i], end).join('\n').trim();
      if (text) questions.push({ page: page.page, text });
    }
  }
  return questions;
}

async function extractPdfPages(file: File): Promise<{ page: number; text: string }[]> {
if (file.size > 10 * 1024 * 1024) throw new Error('Bản mẫu nhận PDF tối đa 10 MB.');
const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
try {
const pdf = await loadingTask.promise;
if (pdf.numPages > 30) throw new Error('Hãy tách PDF còn tối đa 30 trang cho bản mẫu.');
const pages: { page: number; text: string }[] = [];
let total = 0;
for (let n = 1; n <= pdf.numPages; n++) {
const page = await pdf.getPage(n);
const content = await page.getTextContent();
let text = '';
let lastY = Number.NaN;
for (const item of content.items) {
if (!('str' in item)) continue;
const y = item.transform[5];
if (text && Math.abs(y - lastY) > 2) text += '\n';
text += item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ');
lastY = y;
}
total += text.length;
if (total > 150000) throw new Error('PDF có quá nhiều văn bản; hãy tách thành chương nhỏ.');
pages.push({ page: n, text });
page.cleanup();
}
if (pages.map(page => page.text).join('').trim().length < 20)
throw new Error('Không trích được văn bản. PDF có thể là bản scan ảnh; OCR chưa được hỗ trợ. Hãy dùng PDF có thể bôi đen/sao chép chữ.');
return pages;
} finally { await loadingTask.destroy(); }
}

export async function extractPdf(file: File): Promise<string> {
  const pages = await extractPdfPages(file);
  return pages.map(page => `[Trang / Page ${page.page}]\n${page.text}`).join('\n\n');
}

export async function extractPdfQuestions(file: File): Promise<PdfQuestion[]> {
  return splitPdfQuestions(await extractPdfPages(file));
}
