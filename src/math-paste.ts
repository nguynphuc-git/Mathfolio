import { convertAsciiMathToLatex } from 'mathlive';

function prose(value: string): string {
  if (!value) return '';
  return `\\text{${value.replace(/\\/g, '\\textbackslash{}').replace(/[{}%&#_^$]/g, '\\$&')}}`;
}
const mathNames = /\b(?:sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|arcsin|arccos|arctan|log|ln|exp|sqrt|abs|lim|sum|prod|int|pi|alpha|beta|gamma|delta|theta|infty|dx|dy|dt)\b/g;
function isMath(value: string): boolean {
  if (/^\\(?:text|mathrm|operatorname)\{/.test(value)) return true;
  const letters = value.replace(/\\[a-zA-Z]+/g, '').replace(mathNames, '');
  return !/[A-Za-z]{2,}/.test(letters) && !/["'$]/.test(value)
    && /[\dA-Za-zα-ωΑ-Ω=+*/^_<>|!()\[\]{}≤≥≠∈∑∫√∞²³-]/.test(value);
}
function formula(value: string): string {
  if (/\\[a-zA-Z]+/.test(value)) return value;
  const normalized = value.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    // MathLive recognizes (n)/(n+3) as a fraction; bare n/(n+3) stays a slash.
    .replace(/(?<![\w\\])([A-Za-z]|\d+(?:\.\d+)?)\s*\/\s*(?=\()/g, '($1)/');
  return convertAsciiMathToLatex(normalized);
}
/** Conservative local parsing: ordinary words stay text; formulas get math structure.
 * Explicit $...$, \(...\), \[...\] and LaTeX clipboard data take precedence.
 */
export function mixedTextToLatex(value: string): string {
  return value.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).filter(Boolean).map(part => {
    if (part.startsWith('$$') && part.endsWith('$$')) return part.slice(2, -2);
    if (part.startsWith('$') && part.endsWith('$')) return part.slice(1, -1);
    if (/^\\[([]/.test(part)) return part.slice(2, -2);
    return undelimited(part);
  }).join('');
}
function undelimited(value: string): string {
  const tokens: { start: number; end: number; fullEnd: number; math: boolean }[] = [];
  for (let index = 0; index < value.length;) {
    if (/\s/.test(value[index])) { index++; continue; }
    const start = index; let braces = 0;
    do {
      if (value[index] === '{' && value[index - 1] !== '\\') braces++;
      if (value[index] === '}' && value[index - 1] !== '\\') braces = Math.max(0, braces - 1);
      index++;
    } while (index < value.length && (braces > 0 || !/\s/.test(value[index])));
    const core = value.slice(start, index).replace(/[.,;:!?]+$/, '');
    tokens.push({ start, end: start + core.length, fullEnd: index, math: isMath(core) });
  }
  // Avoid turning the English article “a” into a variable in otherwise ordinary prose.
  tokens.forEach((token, index) => {
    if (value.slice(token.start, token.end) === 'a' && !tokens[index - 1]?.math && !tokens[index + 1]?.math) token.math = false;
  });
  let output = '', cursor = 0;
  for (let index = 0; index < tokens.length;) {
    const first = tokens[index];
    if (!first.math) { index++; continue; }
    let last = first;
    while (last.end === last.fullEnd && tokens[index + 1]?.math) last = tokens[++index];
    output += prose(value.slice(cursor, first.start)) + formula(value.slice(first.start, last.end));
    cursor = last.end; index++;
  }
  return output + prose(value.slice(cursor));
}
