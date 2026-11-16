export type GeometryShapeId = 'circle' | 'rectangle' | 'trapezoid' | 'box' | 'cylinder' | 'cone' | 'sphere';

export interface GeometryShape {
  id: GeometryShapeId;
  label: string;
  dimension: '2D' | '3D';
  description: string;
  fields: readonly { key: string; label: string; symbol: string; defaultValue: number }[];
}

/** Structured dimensions keep instant calculations separate from open-ended proofs. */
export const geometryShapes: readonly GeometryShape[] = [
  { id: 'circle', label: 'Circle', dimension: '2D', description: 'Area and circumference from the radius.', fields: [{ key: 'r', label: 'Radius', symbol: 'r', defaultValue: 5 }] },
  { id: 'rectangle', label: 'Rectangle', dimension: '2D', description: 'Area, perimeter and diagonal of a rectangle.', fields: [{ key: 'l', label: 'Length', symbol: 'l', defaultValue: 8 }, { key: 'w', label: 'Width', symbol: 'w', defaultValue: 6 }] },
  { id: 'trapezoid', label: 'Trapezoid', dimension: '2D', description: 'Area from two parallel bases and their perpendicular distance.', fields: [{ key: 'a', label: 'First parallel base', symbol: 'a', defaultValue: 8 }, { key: 'b', label: 'Second parallel base', symbol: 'b', defaultValue: 4 }, { key: 'h', label: 'Perpendicular height', symbol: 'h', defaultValue: 3 }] },
  { id: 'box', label: 'Rectangular prism', dimension: '3D', description: 'Volume, total surface area and space diagonal.', fields: [{ key: 'l', label: 'Length', symbol: 'l', defaultValue: 8 }, { key: 'w', label: 'Width', symbol: 'w', defaultValue: 6 }, { key: 'h', label: 'Height', symbol: 'h', defaultValue: 4 }] },
  { id: 'cylinder', label: 'Right circular cylinder', dimension: '3D', description: 'Volume and total surface area, including both circular bases.', fields: [{ key: 'r', label: 'Radius', symbol: 'r', defaultValue: 3 }, { key: 'h', label: 'Perpendicular height', symbol: 'h', defaultValue: 7 }] },
  { id: 'cone', label: 'Right circular cone', dimension: '3D', description: 'Slant height, volume and total surface area, including the base.', fields: [{ key: 'r', label: 'Radius', symbol: 'r', defaultValue: 3 }, { key: 'h', label: 'Perpendicular height', symbol: 'h', defaultValue: 4 }] },
  { id: 'sphere', label: 'Sphere', dimension: '3D', description: 'Volume and surface area from the radius.', fields: [{ key: 'r', label: 'Radius', symbol: 'r', defaultValue: 3 }] }
];

export const geometryExamples = [
  { id: 'circle-tangent', title: 'Circle & tangent', dimension: '2D', description: 'Use the right angle between a radius and a tangent.', statement: 'A circle has center O and radius 5 cm. P is outside the circle, OP = 13 cm, and PT is tangent to the circle at T. Find PT and justify the theorem you use.' },
  { id: 'cyclic-quadrilateral', title: 'Cyclic quadrilateral', dimension: '2D', description: 'Reason with opposite angles in a cyclic quadrilateral.', statement: 'ABCD is a convex cyclic quadrilateral, with vertices in that order on a circle. Angle DAB is 72 degrees and angle ABC is 105 degrees. Find angles BCD and CDA, giving a reason for each step.' },
  { id: 'solid-pyramid', title: 'Square pyramid', dimension: '3D', description: 'Distinguish perpendicular height, slant height and edges.', statement: 'SABCD is a right square pyramid with square base ABCD of side 6 cm. O is the center of the base and SO = 4 cm, perpendicular to the base plane. Find the volume and total surface area. Show how you obtain the slant height of a triangular face.' },
  { id: 'space-diagonal', title: 'Line & plane angle', dimension: '3D', description: 'Use an orthogonal projection to turn a 3D angle into a triangle.', statement: 'A rectangular prism ABCD-EFGH has E, F, G, H directly above A, B, C, D respectively. AB = 6 cm, BC = 8 cm, and AE = 10 cm. Find the angle between line AG and plane ABCD. Identify the orthogonal projection used.' }
] as const;

interface CalculationStep { label: string; value: number; power: 1 | 2 | 3; formula: string; substitution: string }
export interface GeometryCalculation {
  markdown: string;
  statement: string;
  measurements: { label: string; value: number; unit: string }[];
}
const allowedUnits = ['mm', 'cm', 'm', 'units'] as const;
const numberText = (value: number) => new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8, useGrouping: false }).format(value);
const texNumber = (value: number) => String(value).replace(/e([+-]?\d+)$/i, String.raw`\times 10^{$1}`);
const unitText = (unit: string, power: number) => `${unit}${power === 2 ? '²' : power === 3 ? '³' : ''}`;
const texUnit = (unit: string, power: number) => String.raw`\,\mathrm{${unit}}${power > 1 ? `^{${power}}` : ''}`;

function calculationSteps(id: GeometryShapeId, dimensions: Record<string, number>): CalculationStep[] {
  const { r, l, w, a, b, h } = dimensions;
  const n = texNumber;
  switch (id) {
    case 'circle': return [
      { label: 'Area', value: Math.PI*r*r, power: 2, formula: 'A=\\pi r^2', substitution: `\\pi\\cdot ${n(r)}^2` },
      { label: 'Circumference', value: 2*Math.PI*r, power: 1, formula: 'C=2\\pi r', substitution: `2\\pi\\cdot ${n(r)}` }
    ];
    case 'rectangle': return [
      { label: 'Area', value: l*w, power: 2, formula: 'A=lw', substitution: `${n(l)}\\cdot ${n(w)}` },
      { label: 'Perimeter', value: 2*(l+w), power: 1, formula: 'P=2(l+w)', substitution: `2(${n(l)}+${n(w)})` },
      { label: 'Diagonal', value: Math.hypot(l,w), power: 1, formula: 'd=\\sqrt{l^2+w^2}', substitution: `\\sqrt{${n(l)}^2+${n(w)}^2}` }
    ];
    case 'trapezoid': return [
      { label: 'Area', value: (a+b)*h/2, power: 2, formula: 'A=\\frac{(a+b)h}{2}', substitution: `\\frac{(${n(a)}+${n(b)})\\cdot ${n(h)}}{2}` }
    ];
    case 'box': return [
      { label: 'Volume', value: l*w*h, power: 3, formula: 'V=lwh', substitution: `${n(l)}\\cdot ${n(w)}\\cdot ${n(h)}` },
      { label: 'Total surface area', value: 2*(l*w+l*h+w*h), power: 2, formula: 'S=2(lw+lh+wh)', substitution: `2(${n(l)}\\cdot ${n(w)}+${n(l)}\\cdot ${n(h)}+${n(w)}\\cdot ${n(h)})` },
      { label: 'Space diagonal', value: Math.hypot(l,w,h), power: 1, formula: 'd=\\sqrt{l^2+w^2+h^2}', substitution: `\\sqrt{${n(l)}^2+${n(w)}^2+${n(h)}^2}` }
    ];
    case 'cylinder': return [
      { label: 'Volume', value: Math.PI*r*r*h, power: 3, formula: 'V=\\pi r^2h', substitution: `\\pi\\cdot ${n(r)}^2\\cdot ${n(h)}` },
      { label: 'Total surface area', value: 2*Math.PI*r*(r+h), power: 2, formula: 'S=2\\pi r(r+h)', substitution: `2\\pi\\cdot ${n(r)}(${n(r)}+${n(h)})` }
    ];
    case 'cone': return [
      { label: 'Slant height', value: Math.hypot(r,h), power: 1, formula: 's=\\sqrt{r^2+h^2}', substitution: `\\sqrt{${n(r)}^2+${n(h)}^2}` },
      { label: 'Volume', value: Math.PI*r*r*h/3, power: 3, formula: 'V=\\frac{\\pi r^2h}{3}', substitution: `\\frac{\\pi\\cdot ${n(r)}^2\\cdot ${n(h)}}{3}` },
      { label: 'Total surface area', value: Math.PI*r*(r+Math.hypot(r,h)), power: 2, formula: 'S=\\pi r(r+s)', substitution: `\\pi\\cdot ${n(r)}(${n(r)}+\\sqrt{${n(r)}^2+${n(h)}^2})` }
    ];
    case 'sphere': return [
      { label: 'Volume', value: 4*Math.PI*r*r*r/3, power: 3, formula: 'V=\\frac{4}{3}\\pi r^3', substitution: `\\frac{4}{3}\\pi\\cdot ${n(r)}^3` },
      { label: 'Surface area', value: 4*Math.PI*r*r, power: 2, formula: 'S=4\\pi r^2', substitution: `4\\pi\\cdot ${n(r)}^2` }
    ];
  }
}

function geometryStatement(id: GeometryShapeId, values: Record<string, number>, unit: string): string {
  const dimension = (key: string) => `${values[key]} ${unit}`;
  switch (id) {
    case 'circle': return `A circle has radius ${dimension('r')}. Find its area and circumference.`;
    case 'rectangle': return `A rectangle has length ${dimension('l')} and width ${dimension('w')}. Find its area, perimeter and diagonal.`;
    case 'trapezoid': return `A trapezoid has parallel bases ${dimension('a')} and ${dimension('b')}, and perpendicular height ${dimension('h')}. Find its area.`;
    case 'box': return `A rectangular prism has length ${dimension('l')}, width ${dimension('w')} and height ${dimension('h')}. Find its volume, total surface area and space diagonal.`;
    case 'cylinder': return `A right circular cylinder has radius ${dimension('r')} and perpendicular height ${dimension('h')}. Find its volume and total surface area, including both bases.`;
    case 'cone': return `A right circular cone has radius ${dimension('r')} and perpendicular height ${dimension('h')}. Find its slant height, volume and total surface area, including the base.`;
    case 'sphere': return `A sphere has radius ${dimension('r')}. Find its volume and surface area.`;
  }
}

export function calculateGeometry(id: GeometryShapeId, values: Record<string, number>, unit = 'cm'): GeometryCalculation {
  const shape = geometryShapes.find(item => item.id === id);
  if (!shape) throw new Error('Choose a supported shape.');
  if (!(allowedUnits as readonly string[]).includes(unit)) throw new Error('Use mm, cm, m or units for all dimensions.');
  for (const field of shape.fields) {
    if (!Number.isFinite(values[field.key]) || values[field.key] <= 0) throw new Error(`${field.label} must be a number greater than zero.`);
  }
  const steps = calculationSteps(id, values);
  if (steps.some(step => !Number.isFinite(step.value) || step.value === 0)) throw new Error('These dimensions are outside the supported number range.');
  return {
    statement: geometryStatement(id, values, unit),
    measurements: steps.map(step => ({ label: step.label, value: step.value, unit: unitText(unit, step.power) })),
    markdown: steps.map(step => `**${step.label}**\n\n$${step.formula}=${step.substitution}\\approx ${numberText(step.value)}${texUnit(unit, step.power)}$`).join('\n\n') + '\n\nDecimal results are rounded to 8 significant digits. All dimensions use the same unit.'
  };
}

/** Only our complete measurement statements qualify. Extra conditions go to the tutor. */
export function geometryHelp(statement: string, purpose: string, question = ''): string | undefined {
  if (!['knowledge', 'hint1', 'hint2', 'hint3', 'chat'].includes(purpose)) return;
  if (purpose === 'chat' && !/^(?:please\s+)?(?:solve(?:\s+(?:it|this|the problem))?|show (?:the )?(?:solution|steps)|what is (?:the )?answer)[.!?]?$/i.test(question.replace(/\\text\{([^{}]*)\}/g, '$1').trim())) return;
  const text = statement.replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, '$1').replace(/\s+/g, ' ').trim();
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const shape of geometryShapes) {
    for (const unit of allowedUnits) {
      const placeholders = Object.fromEntries(shape.fields.map((field, index) => [field.key, 100001 + index]));
      let pattern = escapeRegex(geometryStatement(shape.id, placeholders, unit));
      for (const field of shape.fields) pattern = pattern.replace(String(placeholders[field.key]), '([+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)');
      const match = new RegExp(`^${pattern}$`, 'i').exec(text);
      if (!match) continue;
      const values = Object.fromEntries(shape.fields.map((field, index) => [field.key, Number(match[index+1])]));
      let calculation: GeometryCalculation;
      try { calculation = calculateGeometry(shape.id, values, unit); } catch { return; }
      const steps = calculationSteps(shape.id, values);
      const conditions = `${shape.description} Use consistent units${shape.fields.some(field => field.label.includes('Perpendicular')) ? ' and the perpendicular height' : ''}.`;
      if (purpose === 'knowledge' || purpose === 'hint1') return `${conditions}\n\n${steps.map(step => `- **${step.label}:** $${step.formula}$.`).join('\n')}`;
      if (purpose === 'hint2') return `${steps.map(step => `- **${step.label}:** $${step.formula}=${step.substitution}$.`).join('\n')}\n\nEvaluate these expressions, using square units for area and cubic units for volume.`;
      return calculation.markdown;
    }
  }
}

/** Conditional cues, not a theorem oracle: the model must establish each hypothesis. */
export function geometryPromptContext(statement: string, compact = false): string {
  const text = statement.toLowerCase();
  const solid = /\b(?:solid geometry|spatial geometry|3d geometry|sphere|hemisphere|cube|cuboid|prism|pyramid|cylinder|cone|tetrahedron|dihedral|space diagonal)\b/.test(text)
    || /\b(?:line|angle|distance|perpendicular|parallel)\b.{0,65}\bplane\b/.test(text);
  const circle = /\b(?:circle|circles|circular|semicircle|incircle|circumcircle|chord|secant|tangent|cyclic quadrilateral)\b/.test(text);
  const quadrilateral = /\b(?:quadrilateral|rectangle|parallelogram|trapezoid|trapezium|rhombus|kite)\b/.test(text)
    || /\bsquare\s+(?:[a-z]{4}\b|has\b|with\b|of side\b|base\b)/.test(text);
  const triangle = /\b(?:triangle|pythagoras|pythagorean|hypotenuse)\b/.test(text);
  if (!solid && !circle && !quadrilateral && !triangle) return '';
  const common = 'Geometry: identify the given facts and target; use one efficient justified method. Never infer lengths, right angles, parallelism or scale from a sketch. State units; distinguish exact and rounded values.';
  if (compact) {
    const specific = solid
      ? 'In 3D use perpendicular height, distinguish face and space diagonals, and project a line orthogonally before measuring its angle with a plane. State any right/regular-solid assumptions.'
      : circle
        ? 'For circles, a tangent is perpendicular to the radius at contact; cyclic opposite-angle rules require concyclic vertices. Check the stated angle/arc and point order.'
        : quadrilateral
          ? 'Use only properties established for this quadrilateral; equal or perpendicular diagonals are not true for every quadrilateral. Heights must be perpendicular to the base.'
          : 'Check triangle and angle hypotheses before using Pythagoras, similarity or trigonometry.';
    return `${common} ${specific}`;
  }
  const references: string[] = [];
  if (solid) references.push(String.raw`For prisms/cylinders, $V=Bh$; for pyramids/cones, $V=Bh/3$, with base area $B$ and perpendicular height $h$. For a sphere, $V=4\pi r^3/3$, $S=4\pi r^2$. For a right cone, slant height $s=\sqrt{r^2+h^2}$; do not substitute $s$ for $h$ in volume. A line-plane angle uses the line's orthogonal projection; a plane-plane angle uses normals and the requested angle convention. Do not assume a solid is right or regular.`);
  if (circle) references.push(String.raw`For a circle, $A=\pi r^2$, $C=2\pi r$. A tangent at $T$ is perpendicular to radius $OT$. An inscribed angle is half its intercepted arc; check which arc. Opposite angles sum to $180^\circ$ for a convex cyclic quadrilateral. For secants from the same exterior point, external length times whole secant length is equal; for a tangent from that point, it equals tangent length squared. Use only the theorem required.`);
  if (quadrilateral) references.push(String.raw`A simple quadrilateral's interior angles total $360^\circ$. Parallelogram area is base times perpendicular height; trapezoid area is $(a+b)h/2$ for parallel bases $a,b$. Diagonal properties depend on the established type: do not assume a general quadrilateral is cyclic, rectangular, or has perpendicular diagonals.`);
  if (triangle && !solid) references.push(String.raw`Pythagoras requires a right triangle and identified hypotenuse. Otherwise consider $c^2=a^2+b^2-2ab\cos C$ or area $ab\sin C/2$, with the included angle $C$. Establish similarity/congruence conditions before using side ratios.`);
  return `${common}\n${references.join('\n')}\nGive a compact diagram description or useful construction only if needed. Use only relevant references and verify the target; do not list every theorem.`;
}
