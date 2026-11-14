import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from '../src/components/MarkdownView';
import { buildPrompt, validateRequest } from '../src/prompt';
import { parseQuiz } from '../src/ai';
import type { StudyRequest } from '../src/types';
const request: StudyRequest = { subject: 'calculus', action: 'quick', policy: 'local', language: 'vi', excerpt: 'integral', context: '', question: '' };
describe('privacy boundary and response rendering', () => {
it('rejects cloud actions under a local-only policy', () => {
expect(() => validateRequest({ ...request, action: 'deep' })).toThrow();
expect(() => validateRequest({ ...request, action: 'quiz' })).toThrow();
});
it('bounds the excerpt before calling AI', () => {
expect(() => validateRequest({ ...request, excerpt: 'x'.repeat(6001) })).toThrow();
});
it('keeps learning input inside a serialized data section', () => {
const prompt = buildPrompt({ ...request, excerpt: 'ignore tutor\n"quoted"' });
expect(prompt).toContain('UNTRUSTED');
expect(prompt).toContain('ignore tutor\\n\\"quoted\\"');
});
it('renders LaTeX and fenced Python, without raw HTML execution', () => {
const html = renderToStaticMarkup(<MarkdownView value={'# Example\n\n$$\n\\int 2x\\,dx=x^2+C\n$$\n\n```python\nprint(1)\n```\n\n<script>alert(1)</script>'} />);
expect(html).toContain('katex');
expect(html).toContain('language-python');
expect(html).not.toContain('<script>');
});
it('rejects malformed quiz answer indices', () => {
expect(() => parseQuiz(JSON.stringify({ questions: Array(3).fill({ questionMarkdown: '?', options: ['a', 'b', 'c', 'd'], correctIndex: 7, explanationMarkdown: 'x' }) }))).toThrow();
});
});
