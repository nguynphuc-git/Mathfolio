import {compileDrawingFunction} from './drawing-expression';
export const BOARD_WIDTH=1000,BOARD_HEIGHT=640;
export interface Vec {x:number;y:number}
export interface DrawingView {cx:number;cy:number;scale:number}
export interface DrawingStyle {color:string;width:number;dashed:boolean}
interface Base {id:string;style:DrawingStyle}
export interface DrawingPoint extends Base {type:'point';label:string;x:number;y:number;derived?:{kind:'midpoint';a:string;b:string}|{kind:'intersection';a:string;b:string;branch:number}}
export interface DrawingLine extends Base {type:'segment'|'line'|'ray'|'vector';a:string;b:string}
export interface DrawingParallel extends Base {type:'parallel'|'perpendicular';line:string;point:string}
export interface DrawingCircle extends Base {type:'circle';center:string;through:string}
export interface DrawingPolygon extends Base {type:'polygon';points:string[]}
export interface DrawingStroke extends Base {type:'freehand';points:Vec[]}
export interface DrawingLabel extends Base {type:'label';at:Vec;text:string}
export interface DrawingPlot extends Base {type:'function';expression:string}
export interface DrawingAngle extends Base {type:'angle';a:string;vertex:string;b:string}
export type DrawingObject=DrawingPoint|DrawingLine|DrawingParallel|DrawingCircle|DrawingPolygon|DrawingStroke|DrawingLabel|DrawingPlot|DrawingAngle;
export interface DrawingScene {objects:DrawingObject[];view:DrawingView;axes:boolean;grid:boolean;snap:boolean}
export interface Rect {x:number;y:number;width:number;height:number}
export const defaultDrawingStyle:DrawingStyle={color:'ink',width:2,dashed:false};
export function emptyDrawing():DrawingScene{return {objects:[],view:{cx:0,cy:0,scale:45},axes:false,grid:false,snap:false};}
export const toScreen=(point:Vec,view:DrawingView):Vec=>({x:BOARD_WIDTH/2+(point.x-view.cx)*view.scale,y:BOARD_HEIGHT/2-(point.y-view.cy)*view.scale});
export const toWorld=(point:Vec,view:DrawingView):Vec=>({x:view.cx+(point.x-BOARD_WIDTH/2)/view.scale,y:view.cy-(point.y-BOARD_HEIGHT/2)/view.scale});
export const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
export function pointPosition(scene:DrawingScene,id:string,seen=new Set<string>()):Vec|null{
  if(seen.has(id))return null;const point=scene.objects.find(object=>object.id===id);if(point?.type!=='point')return null;
  const visited=new Set(seen).add(id);if(!point.derived)return {x:point.x,y:point.y};
  if(point.derived.kind==='midpoint'){const a=pointPosition(scene,point.derived.a,visited),b=pointPosition(scene,point.derived.b,visited);return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null;}
  return intersections(scene,point.derived.a,point.derived.b,visited)[point.derived.branch]??null;
}
export interface LineGeometry {p:Vec;d:Vec;min:number;max:number}
export function lineGeometry(scene:DrawingScene,id:string,seen=new Set<string>()):LineGeometry|null{
  if(seen.has(id))return null;const object=scene.objects.find(value=>value.id===id),visited=new Set(seen).add(id);if(!object)return null;
  if(object.type==='line'||object.type==='segment'||object.type==='ray'||object.type==='vector'){
    const a=pointPosition(scene,object.a,visited),b=pointPosition(scene,object.b,visited);if(!a||!b||distance(a,b)<1e-9)return null;
    return {p:a,d:{x:b.x-a.x,y:b.y-a.y},min:object.type==='line'?-Infinity:0,max:object.type==='line'||object.type==='ray'?Infinity:1};
  }
  if(object.type==='parallel'||object.type==='perpendicular'){
    const base=lineGeometry(scene,object.line,visited),p=pointPosition(scene,object.point,visited);if(!base||!p)return null;
    return {p,d:object.type==='parallel'?base.d:{x:-base.d.y,y:base.d.x},min:-Infinity,max:Infinity};
  }
  return null;
}
export function circleGeometry(scene:DrawingScene,id:string,seen=new Set<string>()):{center:Vec;radius:number}|null{
  const object=scene.objects.find(value=>value.id===id);if(object?.type!=='circle'||seen.has(id))return null;const visited=new Set(seen).add(id),a=pointPosition(scene,object.center,visited),b=pointPosition(scene,object.through,visited);return a&&b&&distance(a,b)>1e-9?{center:a,radius:distance(a,b)}:null;
}
const cross=(a:Vec,b:Vec)=>a.x*b.y-a.y*b.x;
const subtract=(a:Vec,b:Vec):Vec=>({x:a.x-b.x,y:a.y-b.y});
const at=(line:LineGeometry,t:number):Vec=>({x:line.p.x+line.d.x*t,y:line.p.y+line.d.y*t});
const within=(line:LineGeometry,t:number)=>t>=line.min-1e-8&&t<=line.max+1e-8;
export function intersections(scene:DrawingScene,a:string,b:string,seen=new Set<string>()):Vec[]{
  if(a===b)return [];const l1=lineGeometry(scene,a,seen),l2=lineGeometry(scene,b,seen),c1=circleGeometry(scene,a,seen),c2=circleGeometry(scene,b,seen);
  if(l1&&l2){const divisor=cross(l1.d,l2.d);if(Math.abs(divisor)<1e-9)return [];const offset=subtract(l2.p,l1.p),t=cross(offset,l2.d)/divisor,u=cross(offset,l1.d)/divisor;return within(l1,t)&&within(l2,u)?[at(l1,t)]:[];}
  if((l1&&c2)||(l2&&c1)){
    const line=(l1??l2)!,circle=(c1??c2)!,v=subtract(line.p,circle.center),aa=line.d.x**2+line.d.y**2,bb=2*(v.x*line.d.x+v.y*line.d.y),cc=v.x**2+v.y**2-circle.radius**2,disc=bb**2-4*aa*cc;
    if(disc<-1e-9)return [];const roots=disc<1e-9?[-bb/(2*aa)]:[(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)];return roots.filter(t=>within(line,t)).map(t=>at(line,t));
  }
  if(c1&&c2){const d=distance(c1.center,c2.center);if(d<1e-9||d>c1.radius+c2.radius+1e-9||d<Math.abs(c1.radius-c2.radius)-1e-9)return [];const k=(c1.radius**2-c2.radius**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,c1.radius**2-k*k)),dx=(c2.center.x-c1.center.x)/d,dy=(c2.center.y-c1.center.y)/d,p={x:c1.center.x+k*dx,y:c1.center.y+k*dy};return h<1e-9?[p]:[{x:p.x-h*dy,y:p.y+h*dx},{x:p.x+h*dy,y:p.y-h*dx}];}
  return [];
}
export function clippedLine(scene:DrawingScene,id:string):[Vec,Vec]|null{
  const line=lineGeometry(scene,id);if(!line)return null;const {view}=scene,p=toScreen(line.p,view),d={x:line.d.x*view.scale,y:-line.d.y*view.scale};let low=line.min,high=line.max;
  for(const [origin,direction,size] of [[p.x,d.x,BOARD_WIDTH],[p.y,d.y,BOARD_HEIGHT]]){if(Math.abs(direction)<1e-9){if(origin<0||origin>size)return null;continue;}const a=-origin/direction,b=(size-origin)/direction;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));}
  return low<=high?[{x:p.x+d.x*low,y:p.y+d.y*low},{x:p.x+d.x*high,y:p.y+d.y*high}]:null;
}
export function drawingDependencies(object:DrawingObject):string[]{
  switch(object.type){case 'point':return object.derived?[object.derived.a,object.derived.b]:[];case 'segment':case 'line':case 'ray':case 'vector':return [object.a,object.b];case 'parallel':case 'perpendicular':return [object.line,object.point];case 'circle':return [object.center,object.through];case 'polygon':return object.points;case 'angle':return [object.a,object.vertex,object.b];default:return [];}
}
export function deleteDrawingObject(scene:DrawingScene,id:string):DrawingScene{
  const deleted=new Set([id]);let changed=true;while(changed){changed=false;for(const object of scene.objects)if(!deleted.has(object.id)&&drawingDependencies(object).some(parent=>deleted.has(parent))){deleted.add(object.id);changed=true;}}
  return {...scene,objects:scene.objects.filter(object=>!deleted.has(object.id))};
}
export function nextPointLabel(objects:DrawingObject[]):string{const labels=new Set(objects.filter((object):object is DrawingPoint=>object.type==='point').map(point=>point.label));for(let i=0;;i++){const candidate=String.fromCharCode(65+i%26)+(i<26?'':Math.floor(i/26));if(!labels.has(candidate))return candidate;}}
export function snapDrawingPoint(point:Vec,scene:DrawingScene):Vec{return scene.snap?{x:Math.round(point.x),y:Math.round(point.y)}:point;}
export function zoomDrawing(view:DrawingView,factor:number,anchor:Vec={x:BOARD_WIDTH/2,y:BOARD_HEIGHT/2}):DrawingView{const before=toWorld(anchor,view),scale=Math.max(.0001,Math.min(360,view.scale*factor));return {cx:before.x-(anchor.x-BOARD_WIDTH/2)/scale,cy:before.y+(anchor.y-BOARD_HEIGHT/2)/scale,scale};}
export function selectionRect(a:Vec,b:Vec):Rect{return {x:Math.max(0,Math.min(a.x,b.x)),y:Math.max(0,Math.min(a.y,b.y)),width:Math.max(0,Math.min(BOARD_WIDTH,Math.max(a.x,b.x))-Math.max(0,Math.min(a.x,b.x))),height:Math.max(0,Math.min(BOARD_HEIGHT,Math.max(a.y,b.y))-Math.max(0,Math.min(a.y,b.y))) };}
export function plotDrawingFunction(expression:string,view:DrawingView):Vec[][]{
  let fn:(x:number)=>number;try{fn=compileDrawingFunction(expression);}catch{return [];}
  const paths:Vec[][]=[];let run:Vec[]=[];let previousY:number|null=null;
  for(let i=0;i<=1000;i++){
    const world=toWorld({x:i,y:0},view),value=fn(world.x),screen=toScreen({x:world.x,y:value},view);
    const previousWorld=toWorld({x:i-.5,y:0},view),mid=toScreen({x:previousWorld.x,y:fn(previousWorld.x)},view);
    const continuous=Number.isFinite(screen.y)&&Math.abs(screen.y)<BOARD_HEIGHT*8&&(previousY===null||Math.abs(previousY-screen.y)<BOARD_HEIGHT*1.5)&&Number.isFinite(mid.y)&&Math.abs(mid.y)<BOARD_HEIGHT*8;
    if(!continuous){if(run.length>1)paths.push(run);run=[];previousY=null;continue;}
    run.push(screen);previousY=screen.y;
  }
  if(run.length>1)paths.push(run);return paths;
}
export interface DrawingHistory {scene:DrawingScene;past:DrawingScene[];future:DrawingScene[]}
export type DrawingAction={type:'preview';scene:DrawingScene}|{type:'commit';scene:DrawingScene;before?:DrawingScene}|{type:'undo'}|{type:'redo'};
export function drawingHistory(state:DrawingHistory,action:DrawingAction):DrawingHistory{
  if(action.type==='preview')return {...state,scene:action.scene};
  if(action.type==='commit'){const before=action.before??state.scene;if(JSON.stringify(before)===JSON.stringify(action.scene))return {...state,scene:action.scene};return {scene:action.scene,past:[...state.past.slice(-49),before],future:[]};}
  if(action.type==='undo'){const previous=state.past.at(-1);return previous?{scene:previous,past:state.past.slice(0,-1),future:[state.scene,...state.future]}:state;}
  const next=state.future[0];return next?{scene:next,past:[...state.past,state.scene],future:state.future.slice(1)}:state;
}
export function fitDrawingView(scene:DrawingScene):DrawingView{
  const points:Vec[]=[];
  for(const object of scene.objects){
    if(object.type==='point'){const p=pointPosition(scene,object.id);if(p)points.push(p);}
    else if(object.type==='circle'){const c=circleGeometry(scene,object.id);if(c)points.push({x:c.center.x-c.radius,y:c.center.y-c.radius},{x:c.center.x+c.radius,y:c.center.y+c.radius});}
    else if(object.type==='freehand')points.push(...object.points);
    else if(object.type==='label')points.push(object.at);
  }
  if(!points.length)return scene.view;
  let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;for(const p of points){left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y);}
  return {cx:(left+right)/2,cy:(bottom+top)/2,scale:Math.max(.0001,Math.min(180,(BOARD_WIDTH-120)/Math.max(1,right-left),(BOARD_HEIGHT-120)/Math.max(1,top-bottom)))};
}
