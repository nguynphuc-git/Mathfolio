import { describe, expect, it } from 'vitest';
import { contextFor } from '../src/context';
import { buildPrompt } from '../src/prompt';
import { fileContentType } from '../src/library';
describe('document input and grounding', () => {
it('returns the selected PDF page, not the last page of the document', () => {
const value = contextFor('[Trang / Page 1]\nIntroduction\n[Trang / Page 2]\nDerivative example\n[Trang / Page 3]\nOther', 'Derivative example');
expect(value.page).toBe(2); expect(value.context).toContain('Derivative example');
});
it('does not invent pages for text documents', () => expect(contextFor('Before selected after', 'selected').page).toBeUndefined());
it('asks for manual context when an excerpt is repeated or not found', () => {
expect(contextFor('same same', 'same').found).toBe(false);
expect(contextFor('text', 'missing').found).toBe(false);
});
it('bounds context even for large documents', () => {
expect(contextFor('x'.repeat(9000) + 'UNIQUE' + 'y'.repeat(9000), 'UNIQUE').context.length).toBeLessThanOrEqual(6000);
});
it('keeps document metadata in the prompt and labels added knowledge', () => {
const prompt = buildPrompt({ subject: 'calculus', action: 'quick', policy: 'local', language: 'en', excerpt: 'example', context: '', question: '', documentTitle: 'Calculus.pdf', sourcePage: 2, answerMode: 'expanded' });
expect(prompt).toContain('Additional explanation'); expect(prompt).toContain('Calculus.pdf'); expect(prompt).toContain('"sourcePage":2');
});
it('rejects unsupported and oversized uploads', () => {
expect(() => fileContentType({ name: 'x.exe', size: 5 } as File)).toThrow();
expect(() => fileContentType({ name: 'x.pdf', size: 11 * 1024 * 1024 } as File)).toThrow();
expect(fileContentType({ name: 'x.PDF', size: 5 } as File)).toBe('application/pdf');
});
});
