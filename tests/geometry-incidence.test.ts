import {describe,it,expect} from 'vitest';
import {imo2019Construction} from '../src/geometry-olympiad';
import {exampleProofScene} from '../src/geometry-proof-examples';
import {parseProofScene,resolveProofScene} from '../src/geometry-proof';
import {repairProofIncidences,repairZeroLengthProofEdge} from '../src/geometry-incidence';
import {mixedTextToLatex} from '../src/math-paste';
import {imo1970Scene,imo2019PastedProblem} from './fixtures/geometry-contests';

const determinant=(matrix:number[][]):number=>matrix.length===1?matrix[0][0]:matrix[0].reduce((sum,x,i)=>sum+(-1)**i*x*determinant(matrix.slice(1).map(row=>row.filter((_,j)=>i!==j))),0);
describe('dependent incidence constructions',()=>{
  it('accepts the exact IMO 2019 P2 input and its LaTeX conversion without assuming the target circle',()=>{
    for(const text of [imo2019PastedProblem,mixedTextToLatex(imo2019PastedProblem,true),imo2019PastedProblem.replaceAll('A1','A_1').replaceAll('B1','B_1').replaceAll('P1','P_1').replaceAll('Q1','Q_1')]){
      const scene=exampleProofScene(text)!;expect(scene,text).toBeDefined();expect(scene.circles).toHaveLength(0);
      expect(scene.relations.some(r=>r.kind==='equalAngle')).toBe(true);expect(scene.relations.some(r=>r.kind==='between')).toBe(true);
      const points=resolveProofScene(scene),circleRows=['P','Q','P1','Q1'].map(id=>{const [x,y]=points.get(id)!;return [x*x+y*y,x,y,1];});
      expect(determinant(circleRows)).toBeCloseTo(0,7);
    }
    expect(exampleProofScene(imo2019PastedProblem.replace('parallel to AB','perpendicular to AB'))).toBeUndefined();
    expect(exampleProofScene(imo2019PastedProblem+' Assume AB = AC.')).toBeUndefined();
  });
  it('keeps the incidences and angle equalities when the underlying triangle is changed',()=>{
    for(const offset of [-.4,0,.6]){
      const scene=imo2019Construction();scene.points[0].xyz=[offset,4.3,0];
      const p=resolveProofScene(parseProofScene(JSON.stringify(scene)));
      const q=p.get('Q')!,b=p.get('B')!,b1=p.get('B1')!;
      expect((q[0]-b[0])*(b1[1]-b[1])-(q[1]-b[1])*(b1[0]-b[0])).toBeCloseTo(0,10);
      const circleRows=['P','Q','P1','Q1'].map(id=>{const [x,y]=p.get(id)!;return [x*x+y*y,x,y,1];});
      expect(determinant(circleRows)).toBeCloseTo(0,7);
    }
  });
  it('repairs guessed Q using BB1 and PQ parallel AB while preserving all original constraints',()=>{
    const original=imo2019Construction(),scene=structuredClone(original);
    scene.points[6]={id:'Q',kind:'free',xyz:[-1,.9,0]};
    expect(()=>parseProofScene(JSON.stringify(scene))).toThrow('collinear: B, Q, B1');
    const fixed=repairProofIncidences(scene)!;expect(fixed).toBeDefined();expect(fixed.relations).toEqual(scene.relations);
    expect(fixed.points[6].kind).toBe('parallelIntersection');
    expect(resolveProofScene(fixed).get('Q')).toEqual(resolveProofScene(original).get('Q'));
    expect(scene.points[6].kind).toBe('free');
  });
  it('does not accept an incidence repair that breaks a second constraint',()=>{
    const scene=imo2019Construction();scene.points[6]={id:'Q',kind:'free',xyz:[-1,.9,0]};
    scene.relations.push({kind:'perpendicular',refs:['P','Q','A','B'],source:'contradictory constraint'});
    expect(repairProofIncidences(scene)).toBeUndefined();
  });
  it('separates coincident free edge endpoints only when the full scene remains valid',()=>{
    const scene=imo1970Scene();
    scene.points.push({id:'R',kind:'free',xyz:[0,0,0]});
    scene.edges.push({a:'D',b:'R'});
    let error:unknown;
    try{parseProofScene(JSON.stringify(scene));}catch(caught){error=caught;}
    expect(error).toBeInstanceOf(Error);
    const repaired=repairZeroLengthProofEdge(scene,error)!;
    expect(repaired).toBeDefined();
    expect(resolveProofScene(repaired).get('D')).not.toEqual(resolveProofScene(repaired).get('R'));
    expect(repaired.relations).toEqual(scene.relations);
    expect(scene.points.find(point=>point.id==='R')?.xyz).toEqual([0,0,0]);
  });
  it('enforces point order and angle conditions and rejects malformed line parameters',()=>{
    const outside=imo2019Construction();outside.points[3].t=1.2;
    expect(()=>parseProofScene(JSON.stringify(outside))).toThrow();
    const angle=imo2019Construction();angle.points[7]={id:'P1',kind:'free',xyz:[7,1,0]};
    expect(()=>parseProofScene(JSON.stringify(angle))).toThrow();
    const bad=imo2019Construction();delete bad.points[3].t;
    expect(()=>parseProofScene(JSON.stringify(bad))).toThrow('line parameter');
  });
});
