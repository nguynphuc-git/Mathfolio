import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MathfieldElement } from 'mathlive';
import 'mathlive/fonts.css';
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'en';
export interface MathInputHandle { insert: (latex: string) => void; mode: (mode: 'math' | 'text') => void }
export const MathInput = forwardRef<MathInputHandle, { value: string; onChange?: (value: string) => void; readOnly?: boolean; disabled?: boolean; label?: string; compact?: boolean }>(function MathInput({ value, onChange, readOnly, disabled, label = 'Problem statement', compact }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<MathfieldElement | null>(null);
  const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    const field = new MathfieldElement();
    field.defaultMode = 'math'; field.mathVirtualKeyboardPolicy = 'manual';
    field.setAttribute('aria-label', label); field.setAttribute('role', 'textbox');
    field.setAttribute('placeholder', 'Type your problem here');
    const handleInput = () => {
      if (field.value.length > 6000) { field.value = field.value.slice(0, 6000); }
      change.current?.(field.value);
    };
    field.addEventListener('input', handleInput);
    host.current?.appendChild(field); element.current = field;
    return () => { field.removeEventListener('input', handleInput); field.remove(); element.current = null; };
  }, [label]);
  useEffect(() => { const field = element.current; if (field && field.value !== value) field.value = value; }, [value]);
  useEffect(() => { if (element.current) { element.current.readOnly = !!readOnly || !!disabled; element.current.setAttribute('aria-disabled', String(!!disabled)); } }, [readOnly, disabled]);
  useImperativeHandle(ref, () => ({
    insert(latex) {
      const field = element.current; if (!field || field.readOnly) return;
      field.focus(); field.insert(latex, { format: 'latex', mode: 'math', selectionMode: 'placeholder' });
      change.current?.(field.value);
    },
    mode(mode) { const field = element.current; if (field && !field.readOnly) { field.focus(); field.executeCommand(['switchMode', mode]); } }
  }), []);
  return <div ref={host} className={`math-input${compact ? ' compact' : ''}`}/>;
});
