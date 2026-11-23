import fs from 'node:fs';
import path from 'node:path';

// Selectable text stays sharp at every zoom level.
const dir = path.resolve(import.meta.dirname, 'demo-cases');
const output = path.join(dir, 'algebra-workbook-6-pages.pdf');
const groups = [
  ['Parameters and domains', [
    ['01  Parameterized logarithms', 'For real a, classify solutions of log_2(x - 1) + log_2(a - x) = 1.', 'Give exact roots. Find a when the two roots differ by 1.'],
    ['02  Absolute value parameter', 'For real a, solve |x - a| = x + 1.', 'Classify zero, one, or infinitely many real solutions.'],
    ['03  Positive roots', 'For real a, solve x^2 - 2ax + a^2 - 4 = 0.', 'When are both roots positive? When is exactly one positive?'],
  ]],
  ['Radicals and extraneous roots', [
    ['04  Rational equation with radical', 'Solve (x^2 - 5x + 6)/(x - 2) = sqrt(x + 3).', 'State the domain and reject candidates introduced by squaring.'],
    ['05  Two radicals', 'Solve sqrt(x + 4) + sqrt(9 - x) = 5.', 'Check every candidate in the original equation.'],
    ['06  Radical sign restriction', 'Solve sqrt(2x + 3) = x - 1.', 'Find the stricter domain implied by the nonnegative left side.'],
  ]],
  ['Absolute values and inequalities', [
    ['07  Two breakpoints', 'Solve |x - 2| + |2x + 1| = 7.', 'Show the intervals defined by both absolute-value breakpoints.'],
    ['08  Quadratic in absolute value', 'Solve |x^2 - 5x + 4| = 2.', 'Give all exact real roots.'],
    ['09  Rational sign chart', 'Solve ((x - 1)(x - 4))/((x - 2)(x + 3)) >= 0.', 'Mark zeros and poles; use correct open and closed endpoints.'],
  ]],
  ['Logarithms and rational structure', [
    ['10  Different logarithm bases', 'Solve log_2(x - 1) = log_4(3x + 1).', 'Convert to one base and test the domain.'],
    ['11  Logarithm of a quadratic', 'Solve log_2(x^2 - 5x + 6) = 1.', 'Test both values in the original logarithm.'],
    ['12  Reciprocal substitution', 'Solve (x - 1)/(x + 2) + (x + 2)/(x - 1) = 5/2.', 'State exclusions before setting t = (x - 1)/(x + 2).'],
  ]],
  ['Polynomials and systems', [
    ['13  Even quartic', 'Solve x^4 - 5x^2 + 4 = 0 over the reals.', 'Use y = x^2 and check y >= 0.'],
    ['14  Symmetric system', 'Solve x + y = 5 and x^2 + y^2 = 13 over the reals.', 'Give ordered pairs, not an unordered set.'],
    ['15  Reciprocal fourth-degree equation', 'For x != 0, solve x^2 + 1/x^2 = 7.', 'Give all exact real values.'],
  ]],
  ['Proof and verification', [
    ['16  Removable factor', 'Find all real x satisfying (x^2 - 1)/(x - 1) = x + 1.', 'Explain why cancellation does not restore an excluded input.'],
    ['17  Cubic factorization', 'Solve x^3 - 6x^2 + 11x - 6 = 0.', 'Factor and verify all roots.'],
    ['18  Constrained optimization', 'Let x,y >= 0 and x + y = 6. Find the maximum of xy.', 'State equality and justify global optimality.'],
  ]],
];
const objects = [null];
const add = object => (objects.push(object), objects.length - 1);
const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
const pagesId = add('');
const escape = s => s.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
const pageIds = [];
for (const [index, [title, questions]] of groups.entries()) {
  let body = '0.08 0.24 0.48 rg 0.08 0.24 0.48 RG 1 w 52 771 m 543 771 l S\n';
  const draw = (s, x, y, size, heavy = false) => { body += `BT /${heavy ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escape(s)}) Tj ET\n`; };
  draw(`Page ${index + 1} of ${groups.length}  |  Mathfolio algebra workbook  |  ${title}`, 52, 793, 12, true);
  for (const [number, question] of questions.entries()) {
    const y = 652 - number * 197;
    body += `0.94 0.97 0.99 rg 45 ${y - 115} 505 160 re f 0.08 0.24 0.48 rg\n`;
    draw('Question ' + question[0].replace(/^(\d{2})\s+/, '$1: '), 58, y + 17, 13, true);
    draw(question[1], 58, y - 15, 10.5);
    draw(question[2], 58, y - 41, 10.5);
    draw('Work / check:', 58, y - 93, 9, true);
  }
  const contentId = add({stream: Buffer.from(body)});
  pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${contentId} 0 R >>`));
}
objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
const parts = [Buffer.from('%PDF-1.4\n')], offsets = [0];
let offset = parts[0].length;
for (let id = 1; id < objects.length; id++) {
  offsets[id] = offset;
  const obj = objects[id];
  const bytes = typeof obj === 'string' ? Buffer.from(`${id} 0 obj\n${obj}\nendobj\n`) : Buffer.concat([Buffer.from(`${id} 0 obj\n<< /Length ${obj.stream.length} >>\nstream\n`), obj.stream, Buffer.from('\nendstream\nendobj\n')]);
  parts.push(bytes);
  offset += bytes.length;
}
let trailer = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
for (let id = 1; id < objects.length; id++) trailer += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
trailer += `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
parts.push(Buffer.from(trailer));
fs.writeFileSync(output, Buffer.concat(parts));
console.log(`Wrote ${output} (${groups.length} pages, ${groups.reduce((n, group) => n + group[1].length, 0)} problems)`);
