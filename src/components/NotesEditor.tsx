import { useId, useRef, useState } from 'react';
import { MathKeyboard } from './MathKeyboard';

/** Notes remain ordinary multiline text. Symbols never require a format migration. */
export function NotesEditor({ value, onChange, disabled, label }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string }) {
  const input = useRef<HTMLTextAreaElement>(null); const [open, setOpen] = useState(false); const keyboardId = useId();
  function insert(symbol: string) {
    const field = input.current; if (!field || disabled) return;
    const start = field.selectionStart, end = field.selectionEnd;
    const selected = value.slice(start, end);
    const addition = symbol === '²' || symbol === 'ⁿ' ? selected + symbol
      : symbol === '√()' ? `√(${selected})` : symbol === '()/()' ? `(${selected})/()` : symbol;
    const next = value.slice(0, start) + addition + value.slice(end);
    if (next.length > 30000) return;
    onChange(next);
    const offset = addition.includes('()') ? addition.indexOf('()') + 1 : addition.length;
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + offset, start + offset); });
  }
  return <div className="notes-editor">
    <textarea ref={input} aria-label={label} value={value} disabled={disabled} maxLength={30000} onChange={event => onChange(event.target.value)} placeholder="Write your approach, questions, or what you just learned…"/>
    <button type="button" className="notes-keyboard-toggle" disabled={disabled} aria-expanded={open} aria-controls={keyboardId} onClick={() => setOpen(current => !current)}>{open ? 'Hide math keyboard' : 'Show math keyboard'}</button>
    <div id={keyboardId} className="notes-math-keys" hidden={!open} role="group" aria-label={`${label} math keyboard`}><MathKeyboard notes disabled={disabled} onInsert={symbol => insert(symbol.text)}/></div>
  </div>;
}
