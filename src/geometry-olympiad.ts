import {parseProofScene,type ProofScene} from './geometry-proof';
import {stripProblemLayout} from './problem-text';

export const imo1970Problem=String.raw`In the tetrahedron ABCD, angle BDC is a right angle. Suppose that the foot H of the perpendicular from D to the plane ABC is the intersection of the altitudes of triangle ABC. Prove that $(AB + BC + CA)^2 \leq 6(AD^2 + BD^2 + CD^2)$. For what tetrahedra does equality hold?`;

// Full-statement matching only: changed hypotheses, extra conditions and different
// conclusions must still go through AI. Accept equivalent editor/PDF formatting.
function normalized(statement:string):string {
  return stripProblemLayout(statement)
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g,'$1')
    .replace(/\\(?:left|right)\b/g,'')
    .replace(/\\(?:leq|le)\b|<=/g,'≤').replace(/\\perp\b/g,'⊥')
    .replace(/\\triangle\b|[∆Δ△]/g,'triangle ')
    .replace(/\\\^/g,'^').replace(/\^\{2\}|²/g,'^2')
    .replace(/([A-Z]{2}|\))2\b/g,'$1^2')
    .replace(/\\[,;! ]/g,'').replace(/[\s${}]/g,'');
}
const acceptedStatements=[
  imo1970Problem,
  String.raw`Let ABCD be a nondegenerate tetrahedron with $DB \perp DC$.
Let H be the perpendicular projection of D onto the plane ABC.
Suppose that H is also the orthocenter of triangle ABC.
Prove that $(AB + BC + CA)^2 \leq 6(AD^2 + BD^2 + CD^2)$.
Determine all cases of equality.`,
  'In tetrahedron ABCD, DB is perpendicular to DC. The perpendicular projection H of D onto plane ABC is also the orthocenter of triangle ABC. Prove (AB+BC+CA)^2 <= 6(AD^2+BD^2+CD^2), and characterize equality.'
].map(normalized);

export function olympiadProofScene(statement:string):ProofScene|undefined {
  if(!acceptedStatements.includes(normalized(statement)))return;
  // The hypotheses imply DA, DB, DC are pairwise perpendicular. Unequal axes
  // illustrate a general configuration instead of silently assuming equality.
  // H is computed by projection; it is never a guessed free point.
  return parseProofScene(JSON.stringify({
    dimension:'3D',
    givens:['ABCD is a nondegenerate tetrahedron.','DB is perpendicular to DC.','H is the perpendicular projection of D onto plane ABC.','H is the orthocenter of triangle ABC.'],
    goal:'Prove (AB + BC + CA)^2 ≤ 6(AD^2 + BD^2 + CD^2), and determine when equality holds.',
    points:[{id:'D',kind:'free',xyz:[0,0,0]},{id:'A',kind:'free',xyz:[2,0,0]},{id:'B',kind:'free',xyz:[0,3,0]},{id:'C',kind:'free',xyz:[0,0,4]},{id:'H',kind:'planeFoot',refs:['D','A','B','C']}],
    circles:[],
    edges:[{a:'A',b:'B'},{a:'B',b:'C'},{a:'C',b:'A',hidden:true},{a:'D',b:'A'},{a:'D',b:'B'},{a:'D',b:'C'},{a:'D',b:'H'},{a:'A',b:'H',auxiliary:true},{a:'B',b:'H',auxiliary:true},{a:'C',b:'H',auxiliary:true}],
    relations:[
      {kind:'perpendicular',refs:['B','D','C','D'],source:'angle BDC is a right angle'},
      {kind:'perpendicular',refs:['D','H','A','B'],source:'DH is perpendicular to plane ABC'},
      {kind:'perpendicular',refs:['D','H','A','C'],source:'DH is perpendicular to plane ABC'},
      {kind:'perpendicular',refs:['A','H','B','C'],source:'H is the orthocenter of ABC'},
      {kind:'perpendicular',refs:['B','H','A','C'],source:'H is the orthocenter of ABC'},
      {kind:'perpendicular',refs:['C','H','A','B'],source:'H is the orthocenter of ABC'}
    ],
    constructions:['Join AH, BH and CH to expose the altitude directions. Combine these with DH perpendicular to plane ABC to establish the edge perpendicularities before using Pythagoras.'],
    unresolved:[]
  }));
}
