import {describe,expect,it} from 'vitest';
import {drawingEquationGeometry,prepareDrawingEquations} from '../src/drawing-equations';
import {drawingHitsRect,emptyDrawing,moveDrawingObjects,toWorld,type DrawingEquation} from '../src/drawing';

const row=(latex:string,id='graph'):DrawingEquation=>({id,type:'equation',latex,style:{color:'ink',width:2,dashed:false}});
const relation=(latex:string,parameters:DrawingEquation[]=[])=>prepareDrawingEquations([...parameters,row(latex)]).get('graph')!;
const view={cx:0,cy:0,scale:45,width:1000,height:640};
const segments=(paths:string[])=>paths.flatMap(path=>[...path.matchAll(/M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)/g)].map(match=>[toWorld({x:Number(match[1]),y:Number(match[2])},view),toWorld({x:Number(match[3]),y:Number(match[4])},view)]));

describe('free drawing equations',()=>{
  it.each([
    ['x-y=2',3,1,0],['x=2',2,7,0],['x^{2}+y^{2}=9',0,3,0],
    [String.raw`y=\frac{x^{2}}4`,4,4,0],['2x+1',2,5,0],
    [String.raw`y=\sin(x)`,Math.PI/2,1,0],['y=-x^2',2,-4,0],
    [String.raw`y=\left|x\right|`,-3,3,0]
  ])('evaluates %s without imposing a fixed left-hand side',(latex,x,y,expected)=>{
    const result=relation(latex);expect(result.kind).toBe('relation');expect(result.evaluate!(x,y)[0]).toBeCloseTo(expected);
  });
  it('resolves parameters across rows and plots the screenshot range as eleven lines',()=>{
    const result=relation(String.raw`x-y=\left[-5,\ldots,5\right]+b`,[row('b=-3.13','b')]);
    expect(result.evaluate!(0,0)).toHaveLength(11);result.evaluate!(0,0).forEach((value,i)=>expect(value).toBeCloseTo(8.13-i));
    expect(drawingEquationGeometry(result,view).paths).toHaveLength(11);
    const params=[row('a=b+2','a'),row('b=3','b')];expect(relation('y=ax',params).evaluate!(2,10)).toEqual([0]);
    expect(relation('y=ax',[row('a=[1,3,...,9]','a')]).evaluate!(2,0)).toEqual([-2,-6,-10,-14,-18]);
  });
  it('rejects conflicting, cyclic, nonfinite and invalid list definitions with useful feedback',()=>{
    for(const parameters of [[row('a=b','a'),row('b=a','b')],[row('a=1','a'),row('a=2','a2')],[row('a=x','a')],[row('a=1/0','a')]])expect(relation('y=a',parameters).kind).toBe('error');
    for(const latex of ['y=[1,2]+[1,2,3]','y=[1,...,99]','y=[1,1,...,5]','x<y<2',String.raw`y=\int x`,'window.alert(1)','y=constructor(x)'])expect(relation(latex).kind).toBe('error');
    expect(relation('x-y=b').missing).toEqual(['b']);expect(relation('')).toMatchObject({kind:'empty'});
  });
  it('traces implicit circles and vertical lines near their true zero sets',()=>{
    const circle=segments(drawingEquationGeometry(relation('x^2+y^2=9'),view).paths).flat();
    expect(circle.length).toBeGreaterThan(100);for(const p of circle)expect(Math.abs(p.x*p.x+p.y*p.y-9)).toBeLessThan(.03);
    expect(Math.min(...circle.map(p=>p.x))).toBeLessThan(-2.98);expect(Math.max(...circle.map(p=>p.y))).toBeGreaterThan(2.98);
    const line=segments(drawingEquationGeometry(relation('x=2'),view).paths).flat();expect(line.length).toBeGreaterThan(60);for(const p of line)expect(p.x).toBeCloseTo(2,3);
  });
  it('shades inequalities and avoids drawing false lines through poles',()=>{
    const inequality=relation(String.raw`y\le x`);expect(inequality.operator).toBe('<=');expect(drawingEquationGeometry(inequality,view).fill.length).toBeGreaterThan(100);
    const reciprocal=segments(drawingEquationGeometry(relation('y=1/(x-.1)'),view).paths);expect(reciprocal.length).toBeGreaterThan(50);
    for(const [a,b] of reciprocal)expect((a.x-.1)*(b.x-.1)).toBeGreaterThanOrEqual(0);
  });
  it('keeps equation graphs selectable and moves them as a group while parameters stay definitions',()=>{
    const circle=row('x^2+y^2=9'),scene={...emptyDrawing(),mode:'coordinates' as const,view,objects:[circle,row('b=2','b')]};
    expect(drawingHitsRect(scene,circle.id,{x:630,y:310,width:10,height:20})).toBe(true);
    expect(drawingHitsRect(scene,circle.id,{x:495,y:315,width:10,height:10})).toBe(false);
    const moved=moveDrawingObjects(scene,[circle.id],{x:2,y:1});expect(moved.objects[0]).toMatchObject({latex:circle.latex,offset:{x:2,y:1}});
    expect(drawingHitsRect(moved,circle.id,{x:720,y:265,width:10,height:20})).toBe(true);
    expect(drawingHitsRect({...scene,objects:[{...circle,visible:false}]},circle.id,{x:630,y:310,width:10,height:20})).toBe(false);
  });
});
