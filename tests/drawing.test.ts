import {describe,it,expect} from 'vitest';
import {compileDrawingFunction} from '../src/drawing-expression';
import {defaultDrawingStyle as style,emptyDrawing,fitDrawingView,pointPosition,lineGeometry,circleGeometry,intersections,clippedLine,deleteDrawingObject,zoomDrawing,toScreen,toWorld,selectionRect,drawingHistory,plotDrawingFunction,nextPointLabel,type DrawingObject,type DrawingScene} from '../src/drawing';
const point=(id:string,x:number,y:number):DrawingObject=>({id,label:id,type:'point',x,y,style});
function fixture():DrawingScene{return {...emptyDrawing(),objects:[point('A',-4,0),point('B',4,0),point('C',0,3),{id:'M',type:'point',label:'M',x:0,y:0,derived:{kind:'midpoint',a:'A',b:'B'},style},{id:'AB',type:'segment',a:'A',b:'B',style},{id:'circle',type:'circle',center:'C',through:'A',style},{id:'vertical',type:'perpendicular',line:'AB',point:'C',style}]};}
describe('drawing functions',()=>{
  it.each([['2x + 3',2,7],['-x^2',3,-9],['2^3^2',0,512],['x^-2',2,.25],['2(x+1)',2,6],['sin(pi/2)+cos(0)',0,2],['f(x) = sqrt(x) + abs(-2)',9,5],['y = ln(e)+log(100)',0,3],['x² − 2×x',3,3]])('parses %s with mathematical precedence',(source,x,result)=>{expect(compileDrawingFunction(source)(x)).toBeCloseTo(result);});
  it.each(['constructor(x)','globalThis','x;alert(1)','sin x','x+','((x)','1e309','x='.repeat(200)])('rejects invalid or executable syntax: %s',source=>{expect(()=>compileDrawingFunction(source)).toThrow();});
  it('breaks reciprocal plots across their pole and omits non-real domains',()=>{
    const view=emptyDrawing().view,runs=plotDrawingFunction('1/x',view);expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs.every(run=>run.every(p=>p.x<500)||run.every(p=>p.x>500))).toBe(true);
    expect(plotDrawingFunction('sqrt(x)',view).flat().every(p=>p.x>=500)).toBe(true);
    expect(plotDrawingFunction('unknown(x)',view)).toEqual([]);
  });
});
describe('dependent 2D geometry',()=>{
  it('moves midpoints, circles and perpendiculars with their defining points',()=>{
    let scene=fixture();expect(pointPosition(scene,'M')).toEqual({x:0,y:0});expect(circleGeometry(scene,'circle')?.radius).toBe(5);
    scene={...scene,objects:scene.objects.map(o=>o.id==='A'&&o.type==='point'?{...o,x:-2,y:2}:o)};
    expect(pointPosition(scene,'M')).toEqual({x:1,y:1});expect(circleGeometry(scene,'circle')?.radius).toBeCloseTo(Math.sqrt(5));
    const a=lineGeometry(scene,'AB')!,b=lineGeometry(scene,'vertical')!;expect(a.d.x*b.d.x+a.d.y*b.d.y).toBeCloseTo(0);
  });
  it('computes line-line, line-circle and circle-circle intersections without inventing segment intersections',()=>{
    const scene=fixture();expect(intersections(scene,'AB','vertical')).toEqual([{x:0,y:0}]);
    const hits=intersections(scene,'AB','circle');expect(hits).toHaveLength(2);expect(hits.map(p=>p.x)).toEqual([-4,4]);
    scene.objects.push(point('D',8,3),point('E',8,8),{id:'other',type:'circle',center:'D',through:'E',style});
    const shared=intersections(scene,'circle','other');expect(shared).toHaveLength(2);expect(shared[0].x).toBeCloseTo(4);expect(shared.map(p=>p.y).sort()).toEqual([0,6]);
    scene.objects.push(point('F',7,-3),point('G',7,3),{id:'outside',type:'segment',a:'F',b:'G',style});expect(intersections(scene,'AB','outside')).toEqual([]);
  });
  it('updates derived intersection points and represents degeneracy as undefined',()=>{
    const scene=fixture();scene.objects.push({id:'I',label:'I',type:'point',x:0,y:0,derived:{kind:'intersection',a:'AB',b:'vertical',branch:0},style});expect(pointPosition(scene,'I')).toEqual({x:0,y:0});
    scene.objects=scene.objects.map(o=>o.id==='C'&&o.type==='point'?{...o,x:2}:o);expect(pointPosition(scene,'I')?.x).toBeCloseTo(2);
    scene.objects=scene.objects.map(o=>o.id==='B'&&o.type==='point'?{...o,x:-4}:o);expect(pointPosition(scene,'I')).toBeNull();
  });
  it('clips infinite lines to the board and preserves ray direction',()=>{
    const scene=fixture();scene.objects.push({id:'L',type:'line',a:'A',b:'B',style},{id:'R',type:'ray',a:'C',b:'B',style});
    expect(clippedLine(scene,'L')).toEqual([{x:0,y:320},{x:1000,y:320}]);const ray=clippedLine(scene,'R')!;expect(ray[0]).toEqual(toScreen({x:0,y:3},scene.view));expect(ray[1].x).toBe(1000);
  });
  it('deletes dependent constructions transitively while retaining unrelated free points',()=>{
    const scene=fixture();scene.objects.push({id:'new',type:'line',a:'M',b:'C',style});const next=deleteDrawingObject(scene,'A');
    expect(next.objects.map(o=>o.id).sort()).toEqual(['B','C']);expect(scene.objects).toHaveLength(8);
  });
  it('stops cyclic or missing references safely',()=>{const scene=fixture();scene.objects.push({id:'cycle',type:'point',label:'Z',x:0,y:0,derived:{kind:'midpoint',a:'cycle',b:'A'},style});expect(pointPosition(scene,'cycle')).toBeNull();expect(pointPosition(scene,'missing')).toBeNull();});
});
describe('drawing navigation, selection and history',()=>{
  it('round-trips world coordinates and keeps the zoom anchor fixed',()=>{const view={cx:3,cy:-2,scale:62},p={x:-4,y:9},anchor={x:120,y:200};const screen=toScreen(p,view);expect(toWorld(screen,view)).toEqual(p);const before=toWorld(anchor,view),after=toWorld(anchor,zoomDrawing(view,1.5,anchor));expect(after.x).toBeCloseTo(before.x);expect(after.y).toBeCloseTo(before.y);});
  it('fits circle extents and large coordinates without hiding the construction',()=>{const scene=fixture();scene.objects.push(point('Far',10000,-20000));const view=fitDrawingView(scene);for(const id of ['A','B','C','Far']){const p=toScreen(pointPosition(scene,id)!,view);expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(1000);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.y).toBeLessThanOrEqual(640);}expect(fitDrawingView(emptyDrawing())).toEqual(emptyDrawing().view);});
  it('normalizes reverse crop drags and clamps them to the board',()=>{expect(selectionRect({x:800,y:600},{x:200,y:100})).toEqual({x:200,y:100,width:600,height:500});expect(selectionRect({x:-20,y:-10},{x:1200,y:900})).toEqual({x:0,y:0,width:1000,height:640});});
  it('commits a complete drag as one undo step and invalidates redo after a new edit',()=>{const before=emptyDrawing(),after=fixture();let state=drawingHistory({scene:before,past:[],future:[]},{type:'preview',scene:after});state=drawingHistory(state,{type:'commit',scene:after,before});expect(state.past).toHaveLength(1);state=drawingHistory(state,{type:'undo'});expect(state.scene).toEqual(before);state=drawingHistory(state,{type:'redo'});expect(state.scene).toEqual(after);state=drawingHistory(state,{type:'undo'});state=drawingHistory(state,{type:'commit',scene:{...before,axes:true}});expect(state.future).toEqual([]);});
  it('assigns unused point names beyond Z',()=>{const objects=Array.from({length:26},(_,i)=>({...point(String(i),0,0),label:String.fromCharCode(65+i)} as DrawingObject));expect(nextPointLabel(objects)).toBe('A1');});
});
