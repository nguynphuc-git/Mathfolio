import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import { mixedTextToLatex } from '../math-paste';
import { insertPower } from '../math-editor-actions';
import 'mathlive/fonts.css';
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'en';
export interface MathInputHandle { focus: () => void; insert: (latex: string) => void }
export const MathInput = forwardRef<MathInputHandle, { value: string; onChange?: (value: string) => void; readOnly?: boolean; disabled?: boolean; label?: string; compact?: boolean }>(function MathInput({ value, onChange, readOnly, disabled, label = 'Problem statement', compact }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<MathfieldElement | null>(null);
  const change = useRef(onChange); change.current = onChange;
  const [inputError, setInputError] = useState(''); const validValue = useRef(value);
  const notify = useRef<() => void>(() => {});
  useEffect(() => {
    const field = new MathfieldElement();
    field.defaultMode = 'math'; field.smartMode = true; field.smartFence = true;
    field.smartSuperscript = false; field.mathVirtualKeyboardPolicy = 'manual';
    field.value = validValue.current;
    const flowStyle = window.document.createElement('style');
    // Limit these overrides to the top-level equation. Fraction/root internals keep their layout.
    flowStyle.textContent = `
      .ML__container { display:block!important; min-width:0!important; width:100%!important; padding:0!important; align-items:flex-start!important; }
      .ML__content { display:block!important; overflow:visible!important; width:auto!important; min-width:0!important; padding:0!important; align-self:flex-start!important; }
      .ML__content > .ML__latex { display:block!important; width:100%!important; min-width:0!important; box-sizing:border-box; white-space:normal!important; max-width:100%; }
      .ML__content > .ML__latex > .ML__strut, .ML__content > .ML__latex > .ML__strut--bottom { display:none!important; }
      .ML__content > .ML__latex > .ML__base { display:block!important; width:auto!important; white-space:normal!important; overflow-wrap:anywhere; line-height:1.9; }
      .ML__content > .ML__latex > .ML__base .ML__text { white-space:pre-wrap!important; overflow-wrap:break-word; }
      .ML__content > .ML__latex > .ML__base .mathfolio-line { display:block!important; width:auto!important; white-space:normal!important; min-height:1.9em; margin:0 0 .2em; }
      .ML__content-placeholder { position:absolute; top:0; left:0; }
    `;
    field.shadowRoot?.appendChild(flowStyle);
    field.setAttribute('aria-label', label); field.setAttribute('role', 'textbox');
    field.setAttribute('placeholder', 'Type your problem here');
    const handleInput = () => {
      if (field.value.length > 6000) { field.value = validValue.current; setInputError('Keep the problem within 6,000 characters.'); return; }
      validValue.current = field.value; setInputError('');
      change.current?.(field.value);
    };
    notify.current = handleInput;
    const handlePaste = (event: ClipboardEvent) => {
      if (field.readOnly || !event.clipboardData) return;
      // Let MathLive preserve its own structured copy/paste, such as matrices.
      if (event.clipboardData.getData('application/json+mathlive')) return;
      const latex = event.clipboardData.getData('application/x-latex');
      const text = event.clipboardData.getData('text/plain');
      if (!latex && !text) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const insertion = latex || mixedTextToLatex(text);
      const selection = field.selectionIsCollapsed ? '' : field.getValue(field.selection, 'latex');
      if (field.value.length - selection.length + insertion.length > 6000) { setInputError('Keep the problem within 6,000 characters.'); return; }
      field.insert(insertion, { format:'latex', mode:'math', selectionMode:'after' }); handleInput();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (field.readOnly || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^[\p{Script=Latin}]$/u.test(event.key) && /[^\x00-\x7f]/.test(event.key)) field.mode = 'text';
      if (event.key !== '^') return;
      event.preventDefault(); event.stopImmediatePropagation(); insertPower(field); handleInput();
    };
    field.addEventListener('input', handleInput);
    field.addEventListener('paste', handlePaste, true); field.addEventListener('keydown', handleKey, true);
    host.current?.appendChild(field); element.current = field;
    return () => { field.removeEventListener('input', handleInput); field.removeEventListener('paste', handlePaste, true); field.removeEventListener('keydown', handleKey, true); field.remove(); element.current = null; notify.current = () => {}; };
  }, [label]);
  useEffect(() => { const field = element.current; validValue.current = value; setInputError(''); if (field && field.value !== value) field.value = value; }, [value]);
  useEffect(() => { if (element.current) { element.current.readOnly = !!readOnly || !!disabled; element.current.setAttribute('aria-disabled', String(!!disabled)); } }, [readOnly, disabled]);
  useImperativeHandle(ref, () => ({
    focus() { element.current?.focus(); },
    insert(latex) {
      const field = element.current; if (!field || field.readOnly) return;
      field.focus();
      const power = /^\^\{(.*)\}$/.exec(latex);
      if (power) insertPower(field, power[1] === '#?' ? undefined : power[1]);
      else field.insert(latex, { format: 'latex', mode: 'math', selectionMode: 'placeholder' });
      notify.current();
    }
  }), []);
  return <><div ref={host} className={`math-input${compact ? ' compact' : ''}`}/>{inputError && <small className="error" role="alert">{inputError}</small>}</>;
});
