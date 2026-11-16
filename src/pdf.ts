import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { reconstructPdfText } from './pdf-layout';
GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfQuestion { page: number; text: string }
export interface PdfProgress { stage: 'text' | 'ocr'; page: number; total: number }

export function splitPdfQuestions(pages: { page: number; text: string }[]): PdfQuestion[] {
  const questions: PdfQuestion[] = [];
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const starts = lines.flatMap((line, index) =>
      /^(?:(?:question|problem|exercise|bài(?:\s+tập)?|câu)\s*\d{1,3}(?:\.\d{1,3})*\s*[:.)]?|\(?\d{1,3}[.)])\s+\S/iu.test(line) ? [index] : []);
    const boundaries = starts.length ? starts : [0];
    for (let i = 0; i < boundaries.length; i++) {
      const end = boundaries[i + 1] ?? lines.length;
      const text = lines.slice(boundaries[i], end).join('\n').trim();
      if (text) questions.push({ page: page.page, text });
    }
  }
  return questions;
}

async function extractPdfPages(file: File, onProgress?: (progress: PdfProgress) => void): Promise<{ page: number; text: string }[]> {
if (file.size > 10 * 1024 * 1024) throw new Error('Bản mẫu nhận PDF tối đa 10 MB.');
const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
try {
const pdf = await loadingTask.promise;
if (pdf.numPages > 30) throw new Error('Hãy tách PDF còn tối đa 30 trang cho bản mẫu.');
const pages: { page: number; text: string; source: Awaited<ReturnType<typeof pdf.getPage>> }[] = [];
let total = 0;
for (let n = 1; n <= pdf.numPages; n++) {
const page = await pdf.getPage(n);
onProgress?.({ stage: 'text', page: n, total: pdf.numPages });
const content = await page.getTextContent();
const text = reconstructPdfText(content.items.filter(item => 'str' in item));
total += text.length;
if (total > 150000) throw new Error('PDF có quá nhiều văn bản; hãy tách thành chương nhỏ.');
pages.push({ page: n, text, source: page });
page.cleanup();
}
const scannedPages = pages.filter(page => page.text.trim().length < 20);
if (scannedPages.length) {
const { recognizePdfPages } = await import('./pdf-ocr');
const recognized = await recognizePdfPages(scannedPages.map(({ page, source }) => ({ page, source })),
(page, count) => onProgress?.({ stage: 'ocr', page, total: count }));
for (const result of recognized) {
const target = pages.find(page => page.page === result.page);
if (target && result.text) target.text = [target.text.trim(), result.text].filter(Boolean).join('\n');
}
}
const result = pages.map(({ page, text }) => ({ page, text }));
if (result.map(page => page.text).join('').trim().length < 20)
throw new Error('Không nhận dạng được chữ trong PDF. Hãy thử scan rõ hơn hoặc nhập đề bằng bàn phím/dán LaTeX.');
if (result.reduce((length, page) => length + page.text.length, 0) > 150000)
throw new Error('PDF có quá nhiều văn bản sau OCR; hãy tách thành chương nhỏ.');
return result;
} finally { await loadingTask.destroy(); }
}

export async function extractPdf(file: File): Promise<string> {
  const pages = await extractPdfPages(file);
  return pages.map(page => `[Trang / Page ${page.page}]\n${page.text}`).join('\n\n');
}

export async function extractPdfQuestions(file: File, onProgress?: (progress: PdfProgress) => void): Promise<PdfQuestion[]> {
  return splitPdfQuestions(await extractPdfPages(file, onProgress));
}

export async function renderPdfPagePreview(file: File, pageNumber: number): Promise<string> {
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await loadingTask.promise;
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) throw new Error('Choose a valid PDF page.');
    const page = await pdf.getPage(pageNumber);
    const initial = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 2000 / initial.width, 2000 / initial.height);
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not render the selected PDF page.');
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      return canvas.toDataURL('image/png');
    } finally {
      canvas.width = 0; canvas.height = 0; page.cleanup();
    }
  } finally { await loadingTask.destroy(); }
}
