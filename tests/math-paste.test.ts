import { describe, expect, it, vi } from 'vitest';
import { convertLatexToMarkup } from 'mathlive/ssr';
import { mixedTextToLatex } from '../src/math-paste';
import { insertPower } from '../src/math-editor-actions';

describe('mixed clipboard input', () => {
  it('keeps ordinary prose as text and recognizes an embedded equation', () => {
    const result = mixedTextToLatex('Solve x^2 + 3x = 0 for x.');
    expect(result).toContain(String.raw`\text{Solve }`);
    expect(result).toContain(String.raw`\text{ for }`);
    expect(result).toMatch(/x\^\{?2/);
    expect(result).not.toContain(String.raw`\text{Solve x`);
    expect(convertLatexToMarkup(result)).not.toContain('ML__error');
  });
  it('recognizes fractions in a sentence without italicizing the surrounding words', () => {
    const result = mixedTextToLatex('Prove that the sequence n/(n+3) is a Cauchy sequence.');
    expect(result).toContain(String.raw`\frac`);
    expect(result).toContain(String.raw`\text{Prove that the sequence }`);
    expect(result).toContain(String.raw`\text{ is a Cauchy sequence.}`);
  });
  it.each([
    ['Find $x^{2}+1$ now', String.raw`\text{Find }x^{2}+1\text{ now}`],
    [String.raw`Use \(\frac{1}{2}\) here`, String.raw`\text{Use }\frac{1}{2}\text{ here}`],
    [String.raw`Check \[a+b\] now`, String.raw`\text{Check }a+b\text{ now}`],
    ['Use $$x+y$$ here', String.raw`\text{Use }x+y\text{ here}`]
  ])('respects explicit formula delimiters: %s', (input, expected) => {
    expect(mixedTextToLatex(input)).toBe(expected);
  });
  it('retains LaTeX commands, including spaces in nested text groups', () => {
    expect(mixedTextToLatex(String.raw`Solve \frac{x+1}{2} = 3`)).toContain(String.raw`\frac{x+1}{2}`);
    expect(mixedTextToLatex(String.raw`\text{Find the roots }x^2=4`)).toContain(String.raw`\text{Find the roots }`);
  });
  it('escapes ordinary text punctuation and handles unicode math', () => {
    const result = mixedTextToLatex('Find x² − 2 × x = 0.');
    expect(result).toMatch(/x\^\{?2/);
    expect(convertLatexToMarkup(result)).not.toContain('ML__error');
    expect(mixedTextToLatex('Cost is $5 & tax is 10%')).toContain(String.raw`\&`);
  });
});

describe('superscript insertion', () => {
  it('uses native navigation so a fenced expression remains a single base', () => {
    const field = { mode:'math' as const, selectionIsCollapsed:true, insert:vi.fn(), executeCommand:vi.fn(()=>true) };
    insertPower(field,'2');
    expect(field.executeCommand.mock.calls).toEqual([['moveToSuperscript'],['moveAfterParent']]);
    expect(field.insert).toHaveBeenCalledWith('2',expect.objectContaining({mode:'math'}));
  });
  it('groups a selected expression as the base, preserving it in the template', () => {
    const field = { mode:'math' as const, selectionIsCollapsed:false, insert:vi.fn(), executeCommand:vi.fn(()=>true) };
    insertPower(field);
    expect(field.insert).toHaveBeenCalledWith('{#0}^{#?}',expect.objectContaining({selectionMode:'placeholder'}));
  });
  it('leaves a variable exponent open for multiple characters', () => {
    const field = { mode:'math' as const, selectionIsCollapsed:true, insert:vi.fn(), executeCommand:vi.fn(()=>true) };
    insertPower(field);
    expect(field.executeCommand).toHaveBeenCalledExactlyOnceWith('moveToSuperscript');
    expect(field.insert).not.toHaveBeenCalled();
  });
});
