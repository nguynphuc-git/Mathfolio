import {describe,it,expect} from 'vitest';
import {emptyDrawing,toScreen,toWorld,moveDrawingObjects,deleteDrawingObjects,styleDrawingObjects,drawingHitsRect,drawingHistory,plotDrawingFunction,defaultDrawingStyle as style,type DrawingObject,type DrawingScene} from '../src/drawing';
const p=(id:string,x:number,y:number):DrawingObject=>({id,type:'point',label:id,x,y,style});
const fixture=():DrawingScene=>({...emptyDrawing('blank'),objects:[p('A',-4,0),p('B',4,0),p('C',0,3),{id:'AB',type:'segment',a:'A',b:'B',style},{id:'circle',type:'circle',center:'C',through:'A',style},{id:'M',type:'point',label:'M',x:0,y:0,derived:{kind:'midpoint',a:'A',b:'B'},style}]});
describe('selection transforms and batch edits',()=>{
  it('moves shared defining points once while preserving midpoint/circle construction',()=>{
    const scene=fixture(),moved=moveDrawingObjects(scene,['AB','circle','A','M'],{x:2,y:-1});
    expect(moved.objects.find(o=>o.id==='A')).toMatchObject({x:-2,y:-1});expect(moved.objects.find(o=>o.id==='B')).toMatchObject({x:6,y:-1});expect(moved.objects.find(o=>o.id==='C')).toMatchObject({x:2,y:2});expect(scene.objects[0]).toMatchObject({x:-4,y:0});
    expect(moved.objects.find(o=>o.id==='M')).toMatchObject({derived:{kind:'midpoint',a:'A',b:'B'}});
  });
  it('translates labels, freehand and function graphs together',()=>{
    const scene={...emptyDrawing(),objects:[{id:'text',type:'label',at:{x:1,y:2},text:'Test',style},{id:'stroke',type:'freehand',points:[{x:1,y:1},{x:3,y:4}],style},{id:'graph',type:'function',expression:'x^2',style}] as DrawingObject[]};
    const moved=moveDrawingObjects(scene,['text','stroke','graph'],{x:2,y:3});expect(moved.objects[0]).toMatchObject({at:{x:3,y:5}});expect(moved.objects[1]).toMatchObject({points:[{x:3,y:4},{x:5,y:7}]});
    const graph=moved.objects[2];if(graph.type!=='function')throw Error();expect(graph.offset).toEqual({x:2,y:3});const runs=plotDrawingFunction(graph.expression,moved.view,graph.offset);const sample=runs.flat().find(point=>Math.abs(toWorld(point,moved.view).x-2)<.001)!;expect(toWorld(sample,moved.view).y).toBeCloseTo(3);
  });
  it('styles selected shapes only and deletes their downstream objects in one edit',()=>{
    const scene=fixture(),styled=styleDrawingObjects(scene,['AB','circle'],{dashed:true});expect(styled.objects.filter(o=>o.style.dashed).map(o=>o.id)).toEqual(['AB','circle']);const removed=deleteDrawingObjects(scene,['A','B']);expect(removed.objects.map(o=>o.id)).toEqual(['C']);
  });
  it('selects actual line/circle geometry rather than just overlapping bounding boxes',()=>{
    const scene=fixture();expect(drawingHitsRect(scene,'AB',{x:490,y:300,width:20,height:40})).toBe(true);expect(drawingHitsRect(scene,'AB',{x:490,y:100,width:20,height:20})).toBe(false);
    const center=toScreen({x:0,y:3},scene.view);expect(drawingHitsRect(scene,'circle',{x:center.x-10,y:center.y-10,width:20,height:20})).toBe(false);expect(drawingHitsRect(scene,'circle',{x:center.x+220,y:center.y-10,width:10,height:20})).toBe(true);
  });
});
describe('fixed responsive viewport',()=>{
  it('retains viewport dimensions through zoom/undo/redo without adding a resize undo step',()=>{
    const before=fixture(),next=moveDrawingObjects(before,['AB'],{x:1,y:0});let state=drawingHistory({scene:before,past:[],future:[]},{type:'commit',scene:next});state=drawingHistory(state,{type:'viewport',width:1000,height:510});expect(state.past).toHaveLength(1);state=drawingHistory(state,{type:'undo'});expect(state.scene.view.height).toBe(510);state=drawingHistory(state,{type:'redo'});expect(state.scene.view.height).toBe(510);
    expect(toScreen({x:0,y:0},state.scene.view)).toEqual({x:500,y:255});
  });
  it('keeps the chosen mode when undoing earlier object edits',()=>{let state=drawingHistory({scene:fixture(),past:[],future:[]},{type:'commit',scene:moveDrawingObjects(fixture(),['AB'],{x:1,y:1})});state=drawingHistory(state,{type:'mode',mode:'coordinates'});state=drawingHistory(state,{type:'undo'});expect(state.scene.mode).toBe('coordinates');expect(state.scene.axes).toBe(true);expect(state.scene.grid).toBe(true);});
});
