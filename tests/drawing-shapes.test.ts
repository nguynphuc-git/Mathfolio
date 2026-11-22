import {describe,it,expect} from 'vitest';
import {defaultDrawingStyle as style,emptyDrawing,pointPosition,lineGeometry,moveDrawingObjects,deleteDrawingObject,type DrawingPoint,type DrawingScene} from '../src/drawing';
const p=(id:string,x:number,y:number):DrawingPoint=>({id,type:'point',label:id,x,y,style});
describe('parallelograms and perpendicular endpoints',()=>{
  it('keeps opposite sides parallel and equal when any of the three chosen vertices moves',()=>{
    let scene:DrawingScene={...emptyDrawing(),objects:[p('A',-2,0),p('B',2,0),p('C',3,2),{...p('D',-1,2),derived:{kind:'parallelogram',a:'A',b:'B',c:'C'}},{id:'shape',type:'polygon',points:['A','B','C','D'],style}]};
    scene=moveDrawingObjects(scene,['B'],{x:1,y:1});const [a,b,c,d]=['A','B','C','D'].map(id=>pointPosition(scene,id)!);
    expect({x:d.x-a.x,y:d.y-a.y}).toEqual({x:c.x-b.x,y:c.y-b.y});expect({x:c.x-d.x,y:c.y-d.y}).toEqual({x:b.x-a.x,y:b.y-a.y});
    expect(deleteDrawingObject(scene,'B').objects.map(o=>o.id)).toEqual(['A','C']);
  });
  it('constructs either direction from a point on the base, preserving perpendicularity after edits',()=>{
    let scene:DrawingScene={...emptyDrawing(),objects:[p('A',-3,0),p('B',3,0),{id:'base',type:'segment',a:'A',b:'B',style},{...p('E',-3,2),derived:{kind:'perpendicular-end',line:'base',point:'A',length:2}},{id:'perp',type:'segment',a:'A',b:'E',style}]};
    expect(pointPosition(scene,'E')).toEqual({x:-3,y:2});scene=moveDrawingObjects(scene,['B'],{x:0,y:2});
    const base=lineGeometry(scene,'base')!,perp=lineGeometry(scene,'perp')!;expect(base.d.x*perp.d.x+base.d.y*perp.d.y).toBeCloseTo(0);expect(Math.hypot(perp.d.x,perp.d.y)).toBeCloseTo(2);
    scene={...scene,objects:scene.objects.map(o=>o.id==='E'&&o.type==='point'?{...o,derived:{kind:'perpendicular-end' as const,line:'base',point:'A',length:-2}}:o)};expect(pointPosition(scene,'E')!.y).toBeLessThan(pointPosition(scene,'A')!.y);
    expect(deleteDrawingObject(scene,'base').objects.map(o=>o.id)).toEqual(['A','B']);
  });
});
