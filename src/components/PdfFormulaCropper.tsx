import { useRef, useState } from 'react';
import { recognizeMathFormula } from '../pdf-ocr-local';

interface Crop { x: number; y: number; width: number; height: number }

export function PdfFormulaCropper({ image, onInsert }: { image: string; onInsert: (latex: string) => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function point(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = imageRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  }
  function start(event: React.PointerEvent<HTMLDivElement>) {
    if (busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = point(event);
    setDrag(origin); setCrop({ ...origin, width: 0, height: 0 }); setError('');
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const end = point(event);
    setCrop({ x: Math.min(drag.x, end.x), y: Math.min(drag.y, end.y), width: Math.abs(end.x - drag.x), height: Math.abs(end.y - drag.y) });
  }
  function finish(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    move(event);
    setDrag(null);
  }
  async function recognize() {
    const imageElement = imageRef.current;
    if (!crop || !imageElement || crop.width < 0.01 || crop.height < 0.01) return;
    setBusy(true); setError('');
    const canvas = window.document.createElement('canvas');
    const left = Math.round(crop.x * imageElement.naturalWidth);
    const top = Math.round(crop.y * imageElement.naturalHeight);
    canvas.width = Math.round(crop.width * imageElement.naturalWidth);
    canvas.height = Math.round(crop.height * imageElement.naturalHeight);
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not crop the selected formula.');
      context.drawImage(imageElement, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the formula image.')), 'image/png'));
      const latex = await recognizeMathFormula(blob);
      onInsert(latex);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Local formula recognition failed.');
    } finally {
      canvas.width = 0; canvas.height = 0; setBusy(false);
    }
  }

  return <section className="formula-cropper" aria-label="Local formula OCR">
    <p className="subtle">Drag over one formula, then recognize it as LaTeX locally.</p>
    <div className="formula-crop-stage" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      <img ref={imageRef} src={image} alt="PDF page for formula selection" draggable={false}/>
      {crop && <span className="formula-crop-box" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}/>}
    </div>
    <div className="row"><button type="button" disabled={busy || !crop || crop.width < 0.01 || crop.height < 0.01} onClick={() => void recognize()}>{busy ? 'Recognizing locally…' : 'Recognize formula as LaTeX'}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
