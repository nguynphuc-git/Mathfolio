import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MathfieldElement } from 'mathlive';
import 'mathlive/fonts.css';
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'en';
export interface MathInputHandle { focus: () => void; insert: (latex: string) => void }
export const MathInput = forwardRef<MathInputHandle, { value: string; onChange?: (value: string) => void; readOnly?: boolean; disabled?: boolean; label?: string; compact?: boolean }>(function MathInput({ value, onChange, readOnly, disabled, label = 'Problem statement', compact }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<MathfieldElement | null>(null);
  const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    const field = new MathfieldElement();
    field.defaultMode = 'math'; field.smartMode = true; field.mathVirtualKeyboardPolicy = 'manual';
    const flowStyle = window.document.createElement('style');
    // Limit these overrides to the top-level equation. Fraction/root internals keep their layout.
    flowStyle.textContent = `
      .ML__container { display:block!important; min-width:0!important; width:100%!important; }
      .ML__content { display:block!important; overflow:visible!important; width:auto!important; min-width:0!important; }
      .ML__content > .ML__latex { display:block!important; width:100%!important; min-width:0!important; box-sizing:border-box; white-space:normal!important; max-width:100%; }
      .ML__content > .ML__latex > .ML__base { display:inline!important; width:auto!important; white-space:normal!important; overflow-wrap:anywhere; line-height:2.3; }
      .ML__content > .ML__latex > .ML__base .ML__text { white-space:pre-wrap!important; overflow-wrap:break-word; }
    `;
    field.shadowRoot?.appendChild(flowStyle);
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
    focus() { element.current?.focus(); },
    insert(latex) {
      const field = element.current; if (!field || field.readOnly) return;
      field.focus(); field.insert(latex, { format: 'latex', mode: 'math', selectionMode: 'placeholder' });
      change.current?.(field.value);
    }
  }), []);
  return <div ref={host} className={`math-input${compact ? ' compact' : ''}`}/>;
});
