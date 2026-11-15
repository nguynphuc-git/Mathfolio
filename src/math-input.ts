/** Older notebook pages stored text with $...$ fragments. Keep them readable. */
export function statementLatex(value: string, format?: 'latex'): string {
  if (format === 'latex' || !value) return value;
  if (!/[a-zA-Z]{2,}/.test(value.replace(/\$[^$]*\$/g, ''))) return value.replace(/\$\$?/g, '');
  return value.split(/(\$[^$]+\$)/g).filter(Boolean).map(part => part.startsWith('$') && part.endsWith('$')
    ? part.slice(1, -1)
    : `\\text{${part.replace(/\\/g, '\\textbackslash{}').replace(/[{}%&#_^]/g, '\\$&').replace(/\n/g, ' ')}}`).join('');
}
