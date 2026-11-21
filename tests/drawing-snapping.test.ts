import {describe,expect,it} from 'vitest';
import {defaultDrawingStyle as style,emptyDrawing,pointPosition,lineGeometry,intersections,findDrawingSnap,projectDrawingObject,drawingStrokePoints,deleteDrawingObject,moveDrawingObjects,toScreen,type DrawingObject,type DrawingPoint,type DrawingScene,type Vec} from '../src/drawing';
const point=(id:string,x:number,y:number):DrawingPoint=>({id,label:id,type:'point',x,y,style});
const stroke=(id:string,points:Vec[]):DrawingObject=>({id,type:'freehand',points,style});
const fixture=():DrawingScene=>({...emptyDrawing('blank'),objects:[point('A',-4,0),point('B',4,0),point('P',1,3),{id:'AB',type:'segment',a:'A',b:'B',style}]});
function attach(scene:DrawingScene,position:Vec):DrawingScene{const snap=findDrawingSnap(scene,toScreen(position,scene.view));expect(snap).not.toBeNull();return {...scene,objects:[...scene.objects,{...point('S',snap!.position.x,snap!.position.y),derived:snap!.derived}]};}

describe('perpendicular segments and shared path points',()=>{
  it('keeps a perpendicular foot on the supporting line as the base and source move',()=>{
    let scene=fixture();scene.objects.push({...point('H',0,0),derived:{kind:'projection',line:'AB',point:'P'}},{id:'PH',type:'segment',a:'P',b:'H',style});
    expect(pointPosition(scene,'H')).toEqual({x:1,y:0});
    scene={...scene,objects:scene.objects.map(o=>o.id==='B'&&o.type==='point'?{...o,y:4}:o)};
    const base=lineGeometry(scene,'AB')!,perp=lineGeometry(scene,'PH')!;expect(base.d.x*perp.d.x+base.d.y*perp.d.y).toBeCloseTo(0);
    scene={...scene,objects:scene.objects.map(o=>o.id==='P'&&o.type==='point'?{...o,x:20}:o)};expect(pointPosition(scene,'H')!.x).toBeGreaterThan(4);
    expect(deleteDrawingObject(scene,'AB').objects.map(o=>o.id)).toEqual(['A','B','P']);
  });
  it('prefers a nearby existing point, then exact crossings, then a path projection',()=>{
    const scene=fixture();expect(findDrawingSnap(scene,toScreen({x:-4.1,y:.05},scene.view))).toMatchObject({pointId:'A',kind:'point'});
    scene.objects.push(stroke('curve',[{x:-2,y:-2},{x:0,y:1},{x:2,y:-2}]));
    const crossing=findDrawingSnap(scene,toScreen({x:-.69,y:.08},scene.view));expect(crossing).toMatchObject({kind:'intersection'});expect(crossing!.objects.sort()).toEqual(['AB','curve']);expect(crossing!.position.x).toBeCloseTo(-2/3);expect(crossing!.position.y).toBeCloseTo(0);
    const onLine=findDrawingSnap(scene,toScreen({x:3,y:.1},scene.view));expect(onLine).toMatchObject({kind:'path',derived:{kind:'on-object',object:'AB'}});expect(onLine!.position).toEqual({x:3,y:0});
    expect(findDrawingSnap(scene,toScreen({x:0,y:6},scene.view))).toBeNull();
  });
  it('keeps snapped points attached to lines, circles and freehand strokes after edits',()=>{
    let scene=attach(fixture(),{x:3,y:.1});scene={...scene,objects:scene.objects.map(o=>o.id==='B'&&o.type==='point'?{...o,y:4}:o)};expect(pointPosition(scene,'S')).toEqual({x:3,y:3.5});
    scene={...emptyDrawing('blank'),objects:[point('O',0,0),point('R',2,0),{id:'C',type:'circle',center:'O',through:'R',style}]};scene=attach(scene,{x:0,y:2.1});expect(pointPosition(scene,'S')!.y).toBeCloseTo(2);
    scene={...scene,objects:scene.objects.map(o=>o.id==='R'&&o.type==='point'?{...o,x:4}:o)};expect(pointPosition(scene,'S')!.y).toBeCloseTo(4);
    scene={...emptyDrawing('blank'),objects:[stroke('curve',[{x:-2,y:-1},{x:0,y:1},{x:2,y:-1}])]};scene=attach(scene,{x:-1,y:.1});const before=pointPosition(scene,'S')!;scene=moveDrawingObjects(scene,['curve'],{x:3,y:2});expect(pointPosition(scene,'S')!.x).toBeCloseTo(before.x+3);expect(pointPosition(scene,'S')!.y).toBeCloseTo(before.y+2);
  });
  it('moves shared freehand endpoints and deletes downstream connections consistently',()=>{
    let scene=fixture();scene.objects.push({...stroke('curve',[{x:-4,y:0},{x:-2,y:1},{x:1,y:3}]),start:'A',end:'P'} as DrawingObject);
    scene=moveDrawingObjects(scene,['A'],{x:0,y:2});const curve=scene.objects.find(o=>o.id==='curve')!;if(curve.type!=='freehand')throw Error();expect(drawingStrokePoints(scene,curve)).toEqual([{x:-4,y:2},{x:-2,y:1},{x:1,y:3}]);
    expect(deleteDrawingObject(scene,'A').objects.map(o=>o.id)).toEqual(['B','P']);
  });
});

describe('freehand and sampled curve intersections',()=>{
  it('intersects freehand with segments, circles and another freehand stroke in either order',()=>{
    const scene=fixture();scene.objects.push(stroke('curve',[{x:-2,y:-2},{x:0,y:2},{x:2,y:-2}]),stroke('other',[{x:-3,y:1},{x:3,y:1}]),point('O',0,0),point('R',2,0),{id:'circle',type:'circle',center:'O',through:'R',style});
    expect(intersections(scene,'AB','curve')).toEqual([{x:-1,y:0},{x:1,y:0}]);expect(intersections(scene,'curve','AB')).toEqual(intersections(scene,'AB','curve'));
    expect(intersections(scene,'curve','other')).toEqual([{x:-.5,y:1},{x:.5,y:1}]);expect(intersections(scene,'curve','circle')).toHaveLength(3);
    expect(intersections(scene,'curve','curve')).toEqual([]);
    scene.objects.push(stroke('far',[{x:8,y:-1},{x:8,y:1}]));expect(intersections(scene,'AB','far')).toEqual([]);
  });
  it('deduplicates a crossing at a freehand vertex and updates its dependent point',()=>{
    let scene=fixture();scene.objects.push(stroke('curve',[{x:-2,y:-1},{x:0,y:0},{x:2,y:1}]),{...point('I',0,0),derived:{kind:'intersection',a:'AB',b:'curve',branch:0}});
    expect(intersections(scene,'AB','curve')).toHaveLength(1);expect(pointPosition(scene,'I')).toEqual({x:0,y:0});scene=moveDrawingObjects(scene,['curve'],{x:1,y:0});expect(pointPosition(scene,'I')).toEqual({x:1,y:0});
  });
  it('uses actual equation/function curves and retains captured snapping geometry when panning',()=>{
    let scene={...emptyDrawing('coordinates'),objects:[{id:'eq',type:'equation',latex:'x^2+y^2=9',style},stroke('horizontal',[{x:-4,y:1},{x:4,y:1}]),{id:'fn',type:'function',expression:'x^2',style}] as DrawingObject[]};
    const hits=intersections(scene,'eq','horizontal');expect(hits).toHaveLength(2);expect(hits[0].x).toBeCloseTo(-Math.sqrt(8),2);expect(hits[1].x).toBeCloseTo(Math.sqrt(8),2);
    expect(intersections(scene,'fn','horizontal')).toHaveLength(2);
    const projection=projectDrawingObject(scene,'eq',{x:0,y:3.1})!;expect(projection.position.y).toBeCloseTo(3,2);
    scene=attach(scene,{x:0,y:3.1});const before=pointPosition(scene,'S')!;scene={...scene,view:{...scene.view,cx:20,cy:15,scale:120}};expect(pointPosition(scene,'S')).toEqual(before);
  });
  it('handles empty strokes, degenerate paths and cyclic references safely',()=>{
    const scene=fixture();scene.objects.push(stroke('empty',[]),{...point('bad',0,0),derived:{kind:'on-object',object:'bad',parameter:0}});
    expect(projectDrawingObject(scene,'empty',{x:0,y:0})).toBeNull();expect(intersections(scene,'empty','AB')).toEqual([]);expect(pointPosition(scene,'bad')).toBeNull();
  });
});
