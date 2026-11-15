import { describe, expect, it } from 'vitest';
import { convertLatexToMarkup } from 'mathlive/ssr';
import { statementLatex } from '../src/math-input';
describe('typeset problem statements', () => {
  it('keeps new math values free of dollar-delimiter wrapping', () => {
    const value = String.raw`x^{2}+3=2`;
    expect(statementLatex(value, 'latex')).toBe(value);
    const rendered = convertLatexToMarkup(value);
    expect(rendered).toContain('ML__');
    expect(rendered).not.toContain('x^{2}');
  });
  it('renders saved fractions and square roots as math, not literal commands', () => {
    const rendered = convertLatexToMarkup(statementLatex(String.raw`\frac{1}{2}+\sqrt{x}`, 'latex'));
    expect(rendered).toContain('ML__');
    expect(rendered).not.toContain(String.raw`\frac{`);
    expect(rendered).not.toContain(String.raw`\sqrt{`);
  });
  it('preserves older plain-text statements and embedded math without rewriting stored data', () => {
    const original = 'Solve $x^2+3=2$';
    expect(statementLatex(original)).toBe(String.raw`\text{Solve }x^2+3=2`);
    expect(original).toBe('Solve $x^2+3=2$');
    expect(statementLatex('x$^{2}$+3=2')).toBe('x^{2}+3=2');
  });
  it('keeps the format marker and snapshot stable across saving and reopening', async () => {
    const {newExercise,putExercise,emptyNotebook}=await import('../src/notebook');
    const page={...newExercise(),title:'Quadratic',statement:'x^{2}+3=2'};
    expect(page.statementFormat).toBe('latex');
    expect(putExercise(emptyNotebook(),page).exercises[0].statement).toBe(page.statement);
  });
});
