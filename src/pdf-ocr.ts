import { createWorker, OEM } from 'tesseract.js';
import type { PDFPageProxy } from 'pdfjs-dist';

export async function recognizePdfPages(
  pages: { page: number; source: PDFPageProxy }[],
  onProgress?: (page: number, total: number) => void
): Promise<{ page: number; text: string }[]> {
  const assetBase = new URL(import.meta.env.BASE_URL, window.location.href);
  const ocrBase = new URL('ocr/', assetBase);
  const worker = await createWorker('vie+eng', OEM.LSTM_ONLY, {
    workerPath: new URL('worker.min.js', ocrBase).href,
    corePath: new URL('tesseract-core-simd-lstm.wasm.js', ocrBase).href,
    langPath: new URL('lang-data/', ocrBase).href,
    gzip: true
  });
  try {
    const results: { page: number; text: string }[] = [];
    for (const [index, item] of pages.entries()) {
      onProgress?.(index + 1, pages.length);
      const viewport = item.source.getViewport({ scale: 2 });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare this PDF page for local OCR.');
      try {
        await item.source.render({ canvas, canvasContext: context, viewport }).promise;
        const { data } = await worker.recognize(canvas);
        results.push({ page: item.page, text: data.text.trim() });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    return results;
  } finally {
    await worker.terminate();
  }
}
