import {useEffect,useLayoutEffect,useMemo,useReducer,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {drawingSize,defaultDrawingStyle,deleteDrawingObjects,distance,drawingHistory,drawingHitsRect,emptyDrawing,findDrawingSnap,fitDrawingView,isDrawingPath,projectDrawingObject,intersections,lineGeometry,moveDrawingObjects,nextPointLabel,pointPosition,selectionRect,snapDrawingPoint,styleDrawingObjects,toScreen,toWorld,zoomDrawing,type DrawingMode,type DrawingObject,type DrawingScene,type DrawingStyle,type DrawingEquation,type DrawingSnap,type DrawingPoint,type Rect,type Vec} from '../drawing';
import {prepareDrawingEquations} from '../drawing-equations';
import {DrawingEquations} from './DrawingEquations';
import {exportDrawing} from '../drawing-export';
import {lockBodyScroll} from '../scroll-lock';
import {DrawingArtwork} from './DrawingArtwork';
import {MathInput} from './MathInput';
import {SelectMenu} from './SelectMenu';
import '../drawing.css';
type Tool='select'|'pan'|'point'|'segment'|'line'|'ray'|'vector'|'midpoint'|'circle'|'parallel'|'perpendicular'|'perpendicular-segment'|'intersection'|'polygon'|'rectangle'|'angle'|'freehand'|'label';
const tools:{id:Tool;label:string;icon:string;hint:string}[]=[
  {id:'select',label:'Select / move',icon:'↖',hint:'Drag empty space to pan. Shift + click or drag to select more. Drag a selected shape to move it.'},{id:'pan',label:'Pan',icon:'↔',hint:'Drag the canvas to move the view. Scroll to zoom.'},
  {id:'point',label:'Point',icon:'•',hint:'Click to place a point. Use Coordinates for exact placement.'},{id:'midpoint',label:'Midpoint',icon:'M',hint:'Choose two existing points. The midpoint follows them.'},
  {id:'segment',label:'Segment',icon:'╱',hint:'Choose or place two endpoints.'},{id:'line',label:'Line',icon:'⟷',hint:'Choose or place two points on the infinite line.'},
  {id:'ray',label:'Ray',icon:'⟶',hint:'Choose the start, then a point in the direction of the ray.'},{id:'vector',label:'Vector',icon:'→',hint:'Choose or place the start and end.'},
  {id:'circle',label:'Circle',icon:'○',hint:'Choose or place the center, then a point on the circle.'},{id:'parallel',label:'Parallel',icon:'∥',hint:'Choose a line or segment, then a point for the parallel line.'},
  {id:'perpendicular',label:'Perpendicular',icon:'⊥',hint:'Choose a line or segment, then a point for the perpendicular.'},{id:'perpendicular-segment',label:'Perp. segment',icon:'⊥',hint:'Choose a base line, then a point. Draw a segment from that point to its perpendicular foot.'},{id:'intersection',label:'Intersection',icon:'⋂',hint:'Choose two paths: lines, circles, freehand strokes or equation curves.'},
  {id:'polygon',label:'Polygon',icon:'△',hint:'Choose vertices, then click the first vertex or Finish polygon.'},{id:'rectangle',label:'Rectangle',icon:'▭',hint:'Click two opposite corners.'},
  {id:'angle',label:'Angle',icon:'∠',hint:'Choose three points: arm, vertex, arm. Nearby paths can supply a shared point.'},{id:'freehand',label:'Freehand',icon:'〰',hint:'Drag to draw a freehand stroke.'},
  {id:'label',label:'Text label',icon:'T',hint:'Enter label text below, then click where it belongs.'}
];
interface Props {initialScene?:DrawingScene;onScene:(scene:DrawingScene)=>void;onClose:()=>void;onUse:(image:{name:string;data:string})=>Promise<boolean>;suspended:boolean}
interface Drag {kind:'group'|'pan'|'freehand'|'marquee';start:Vec;before:DrawingScene;ids:string[];baseSelection:string[];id?:string}
const uid=()=>crypto.randomUUID();
const number=(value:number)=>Number(value.toFixed(5));
export function IllustrationDrawing({initialScene,onScene,onClose,onUse,suspended}:Props){
  const [history,dispatch]=useReducer(drawingHistory,{scene:initialScene??emptyDrawing(),past:[],future:[]}),{scene}=history;
  const sceneRef=useRef(scene);sceneRef.current=scene;
  const [toolboxOpen,setToolboxOpen]=useState(window.innerWidth>850);
  const [tool,setTool]=useState<Tool>('select'),[pending,setPending]=useState<string[]>([]),[selected,setSelected]=useState<string[]>([]);
  const [style,setStyle]=useState<DrawingStyle>({...defaultDrawingStyle}),[marquee,setMarquee]=useState<Rect|null>(null),[error,setError]=useState(''),[hover,setHover]=useState<DrawingSnap|null>(null),[working,setWorking]=useState(false);
  const [label,setLabel]=useState('Label'),[name,setName]=useState('My illustration');
  const [pointName,setPointName]=useState(''),[pointX,setPointX]=useState('0'),[pointY,setPointY]=useState('0');
  const svg=useRef<SVGSVGElement>(null),dialog=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),drag=useRef<Drag|null>(null),operation=useRef<AbortController|null>(null);
  const coordinates=scene.mode==='coordinates',size=drawingSize(scene.view);
  const equationRows=scene.objects.filter((object):object is DrawingEquation=>object.type==='equation'),equationSignature=JSON.stringify(equationRows.map(row=>[row.id,row.latex]));
  const prepared=useMemo(()=>prepareDrawingEquations(equationRows),[equationSignature]);
  const hasContent=scene.objects.some(object=>object.type!=='equation'||object.visible!==false&&prepared.get(object.id)?.kind==='relation');
  const state=useRef({suspended,working,onClose,tool,pending,selected});state.current={suspended,working,onClose,tool,pending,selected};
  const selectedObjects=scene.objects.filter(item=>selected.includes(item.id)),object=selectedObjects.length===1?selectedObjects[0]:undefined,currentStyle=object?.style??style;
  const dashed=selectedObjects.length?selectedObjects.every(item=>item.style.dashed):style.dashed,solid=selectedObjects.length?selectedObjects.every(item=>!item.style.dashed):!style.dashed;
  useEffect(()=>onScene(scene),[scene,onScene]);
  useEffect(()=>{const query=window.matchMedia('(max-width:850px)');const update=()=>setToolboxOpen(!query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  function show(next:DrawingScene,preview=false,before?:DrawingScene){sceneRef.current=next;dispatch(preview?{type:'preview',scene:next}:{type:'commit',scene:next,before});}
  function chooseMode(mode:DrawingMode){setHover(null);dispatch({type:'mode',mode});setPending([]);setSelected([]);setError('');}
  function chooseTool(next:Tool){setHover(null);setTool(next);setPending([]);setError('');if(window.innerWidth<=850)setToolboxOpen(false);}
  function undo(){drag.current=null;setPending([]);setSelected([]);setMarquee(null);dispatch({type:'undo'});}
  function redo(){drag.current=null;setPending([]);setSelected([]);setMarquee(null);dispatch({type:'redo'});}
  function deleteSelected(){if(!selected.length)return;show(deleteDrawingObjects(sceneRef.current,selected));setSelected([]);setPending([]);}
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,release=lockBodyScroll();close.current?.focus();
    const handle=(event:KeyboardEvent)=>{
      if(state.current.suspended||event.defaultPrevented)return;
      if(event.target instanceof Element&&event.target.closest('[role="listbox"],.symbol-browser'))return;
      const path=event.composedPath(),input=path.some(node=>node instanceof Element&&node.matches('input,textarea,math-field,[contenteditable="true"]'));
      if(event.key==='Escape'&&!state.current.working){event.preventDefault();if(drag.current){show(drag.current.before,true);drag.current=null;setMarquee(null);return;}if(state.current.pending.length){setPending([]);return;}if(state.current.tool!=='select'){setTool('select');return;}state.current.onClose();return;}
      if(!input&&!state.current.working){
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();return;}
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return;}
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();setSelected(sceneRef.current.objects.map(item=>item.id));return;}
        if((event.key==='Delete'||event.key==='Backspace')&&state.current.selected.length){event.preventDefault();show(deleteDrawingObjects(sceneRef.current,state.current.selected));setSelected([]);return;}
      }
      if(event.key!=='Tab')return;const nodes=[...dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),math-field,[tabindex="0"]')??[]].filter(node=>!node.closest('[hidden],details:not([open])'));
      const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handle);return()=>{operation.current?.abort();operation.current=null;document.removeEventListener('keydown',handle);release();previous?.focus();};
  },[]);
  useLayoutEffect(()=>{
    const element=svg.current;if(!element)return;
    const measure=()=>{const bounds=element.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;const width=1000,height=Math.round(bounds.height/bounds.width*100000)/100;if(Math.abs((sceneRef.current.view.height??640)-height)<.05&&sceneRef.current.view.width===width)return;
      if(drag.current){show(drag.current.before,true);drag.current=null;setMarquee(null);}sceneRef.current={...sceneRef.current,view:{...sceneRef.current.view,width,height}};dispatch({type:'viewport',width,height});
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[scene.mode]);
  function localPosition(clientX:number,clientY:number):Vec{
    const element=svg.current!,matrix=element.getScreenCTM?.();if(matrix){const point=element.createSVGPoint();point.x=clientX;point.y=clientY;const result=point.matrixTransform(matrix.inverse());return {x:result.x,y:result.y};}
    const bounds=element.getBoundingClientRect(),{width,height}=drawingSize(sceneRef.current.view);return {x:(clientX-bounds.left)/bounds.width*width,y:(clientY-bounds.top)/bounds.height*height};
  }
  const wheelHandler=useRef<(event:WheelEvent)=>void>(()=>{});
  wheelHandler.current=event=>{if(state.current.working||state.current.suspended||drag.current)return;event.preventDefault();show({...sceneRef.current,view:zoomDrawing(sceneRef.current.view,event.deltaY>0?.9:1.1,localPosition(event.clientX,event.clientY))});};
  useEffect(()=>{const element=svg.current;const handle=(event:WheelEvent)=>wheelHandler.current(event);element?.addEventListener('wheel',handle,{passive:false});return()=>element?.removeEventListener('wheel',handle);},[scene.mode]);
  function append(items:DrawingObject[],base=sceneRef.current){if(base.objects.length+items.length>300){setError('This drawing supports up to 300 objects.');return false;}show({...base,objects:[...base.objects,...items]});setSelected(items.at(-1)?[items.at(-1)!.id]:[]);setError('');return true;}
  function makePoint(position:Vec,objects=sceneRef.current.objects):DrawingPoint{return {id:uid(),type:'point',label:nextPointLabel(objects),...position,style:{...style}};}
  function nearby(position:Vec):string|null{let result:string|null=null,best=14;for(const item of sceneRef.current.objects)if(item.type==='point'){const point=pointPosition(sceneRef.current,item.id);if(point){const d=distance(toScreen(point,sceneRef.current.view),position);if(d<best){best=d;result=item.id;}}}return result;}
  function snapRadius(){const bounds=svg.current?.getBoundingClientRect();return bounds?.width?14*drawingSize(sceneRef.current.view).width/bounds.width:14;}
  function sharedPoint(snap:DrawingSnap,objects=sceneRef.current.objects):DrawingPoint|null{if(snap.pointId)return null;return {...makePoint(snap.position,objects),derived:snap.derived};}
  function nearestPath(position:Vec,exclude:string[]=[],lineOnly=false):string|null{let best=snapRadius(),id:string|null=null;const base=sceneRef.current;for(const item of base.objects){if(exclude.includes(item.id)||!isDrawingPath(base,item.id)||lineOnly&&!lineGeometry(base,item.id))continue;const projection=projectDrawingObject(base,item.id,toWorld(position,base.view));if(projection){const d=distance(toScreen(projection.position,base.view),position);if(d<best){best=d;id=item.id;}}}return id;}
  function finishPolygon(){if(pending.length<3){setError('Choose at least three vertices.');return;}if(append([{id:uid(),type:'polygon',points:pending,style:{...style}}]))setPending([]);}
  function pick(id:string){
    const base=sceneRef.current,hit=base.objects.find(item=>item.id===id);if(!hit)return;
    if(tool==='select'){setSelected([id]);return;}
    if(tool==='intersection'){
      if(!isDrawingPath(base,id)){setError('Choose a line, circle, freehand stroke or equation curve.');return;}
      if(!pending.length){setPending([id]);setSelected([id]);return;}if(pending[0]===id)return;
      const points=intersections(base,pending[0],id);if(!points.length){setError('These objects do not have a unique visible intersection.');return;}
      const items:DrawingObject[]=[],ids:string[]=[];for(const [branch,position] of points.entries()){const existing=[...base.objects,...items].find(item=>item.type==='point'&&(()=>{const p=pointPosition({...base,objects:[...base.objects,...items]},item.id);return p&&distance(toScreen(p,base.view),toScreen(position,base.view))<1.5;})());if(existing){ids.push(existing.id);continue;}const item=makePoint(position,[...base.objects,...items]);item.derived={kind:'intersection',a:pending[0],b:id,branch,...(base.objects.some(o=>[pending[0],id].includes(o.id)&&['function','equation'].includes(o.type))?{view:{...base.view}}:{})};items.push(item);ids.push(item.id);}if(items.length)append(items);setSelected(ids);setError('');setPending([]);return;
    }
    if(tool==='parallel'||tool==='perpendicular'||tool==='perpendicular-segment'){
      if(!pending.length){if(!lineGeometry(base,id)){setError('Choose a line or segment first.');return;}setPending([id]);setSelected([id]);return;}
      if(hit.type!=='point'){setError('Choose a point for the new line.');return;}
      if(tool==='perpendicular-segment'){
        const foot=makePoint({x:0,y:0});foot.derived={kind:'projection',line:pending[0],point:id};const next={...base,objects:[...base.objects,foot]},position=pointPosition(next,foot.id),from=pointPosition(base,id);
        if(!position||!from||distance(position,from)<1e-8){setError('Choose a point away from the base line.');return;}
        foot.x=position.x;foot.y=position.y;append([foot,{id:uid(),type:'segment',a:id,b:foot.id,style:{...style}}]);
      }else append([{id:uid(),type:tool,line:pending[0],point:id,style:{...style}}]);setPending([]);return;
    }
    if(hit.type!=='point'){setError('Choose a point.');return;}
    if(tool==='point'){setSelected([id]);return;}
    if(tool==='polygon'&&pending[0]===id&&pending.length>=3){finishPolygon();return;}
    if(pending.includes(id)){setError('Choose a different point.');return;}
    const points=[...pending,id];setSelected([id]);setError('');
    if(tool==='polygon'){setPending(points);return;}
    if(tool==='angle'){if(points.length<3){setPending(points);return;}append([{id:uid(),type:'angle',a:points[0],vertex:points[1],b:points[2],style:{...style}}]);setPending([]);return;}
    if(points.length<2){setPending(points);return;}
    const a=pointPosition(base,points[0])!,b=pointPosition(base,points[1])!;if(distance(a,b)<1e-8){setError('Choose distinct points.');return;}
    if(tool==='midpoint'){const point=makePoint({x:(a.x+b.x)/2,y:(a.y+b.y)/2});if(point.type==='point')point.derived={kind:'midpoint',a:points[0],b:points[1]};append([point]);}
    else if(tool==='circle')append([{id:uid(),type:'circle',center:points[0],through:points[1],style:{...style}}]);
    else if(tool==='rectangle'){
      if(Math.abs(a.x-b.x)<1e-8||Math.abs(a.y-b.y)<1e-8){setError('Choose opposite corners with different x and y values.');return;}
      const p=makePoint({x:b.x,y:a.y}),q=makePoint({x:a.x,y:b.y},[...base.objects,p]);append([p,q,{id:uid(),type:'polygon',points:[points[0],p.id,points[1],q.id],style:{...style}}]);
    }else if(['segment','line','ray','vector'].includes(tool))append([{id:uid(),type:tool as 'segment'|'line'|'ray'|'vector',a:points[0],b:points[1],style:{...style}}]);
    setPending([]);
  }
  function down(event:ReactPointerEvent<SVGSVGElement>){
    if(working||suspended||event.button!==0)return;const position=localPosition(event.clientX,event.clientY),base=sceneRef.current,{width,height}=drawingSize(base.view);if(position.x<0||position.y<0||position.x>width||position.y>height)return;
    event.preventDefault();svg.current?.focus({preventScroll:true});svg.current?.setPointerCapture?.(event.pointerId);
    setHover(null);const snap=['select','pan','intersection','label'].includes(tool)||['parallel','perpendicular','perpendicular-segment'].includes(tool)&&!pending.length?null:findDrawingSnap(base,position,snapRadius()),world=snap?.position??snapDrawingPoint(toWorld(position,base.view),base),hit=(event.target as Element).closest('[data-object-id]')?.getAttribute('data-object-id')??null,point=nearby(position);
    if(tool==='pan'){drag.current={kind:'pan',start:position,before:base,ids:[],baseSelection:selected};return;}
    if(tool==='freehand'){
      if(base.objects.length>=300){setError('This drawing supports up to 300 objects.');return;}const anchor=snap?sharedPoint(snap):null;if(anchor&&base.objects.length>=299){setError('This drawing supports up to 300 objects.');return;}const item:DrawingObject={id:uid(),type:'freehand',points:[world],start:snap?.pointId??anchor?.id,style:{...style}};show({...base,objects:[...base.objects,...(anchor?[anchor]:[]),item]},true);setSelected([item.id]);drag.current={kind:'freehand',start:position,before:base,id:item.id,ids:[item.id],baseSelection:selected};return;
    }
    if(tool==='label'){if(!label.trim()){setError('Enter label text first.');return;}append([{id:uid(),type:'label',at:world,text:label.trim().slice(0,120),style:{...style}}]);return;}
    if(tool==='select'){
      const id=point??hit;
      if(id){
        if(event.shiftKey){setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);return;}
        const group=selected.includes(id)?selected:[id];setSelected(group);drag.current={kind:'group',start:position,before:base,ids:group,baseSelection:group};
      }else{const group=event.shiftKey?selected:[];setSelected(group);drag.current={kind:event.shiftKey?'marquee':'pan',start:position,before:base,ids:[],baseSelection:group};}
      return;
    }
    if(tool==='intersection'||((tool==='parallel'||tool==='perpendicular'||tool==='perpendicular-segment')&&!pending.length)){const path=nearestPath(position,pending,tool!=='intersection');if(path)pick(path);else setError('Choose an existing path.');return;}
    if(snap){const anchor=sharedPoint(snap);if(anchor){if(append([anchor]))pick(anchor.id);}else if(snap.pointId)pick(snap.pointId);return;}
    if(point){pick(point);return;}if(tool==='midpoint'||tool==='angle'){setError('Place the defining points first, then choose them.');return;}
    const item=makePoint(world);if(append([item]))pick(item.id);
  }
  function move(event:ReactPointerEvent<SVGSVGElement>){
    const job=drag.current,position=localPosition(event.clientX,event.clientY),base=sceneRef.current;
    if(!job){if(working||suspended||['select','pan','intersection','label'].includes(tool)||['parallel','perpendicular','perpendicular-segment'].includes(tool)&&!pending.length){setHover(null);return;}setHover(findDrawingSnap(base,position,snapRadius()));return;}if(distance(job.start,position)<2)return;
    if(job.kind==='marquee'){const {width,height}=drawingSize(base.view),rect=selectionRect(job.start,position,width,height);setMarquee(rect);setSelected([...new Set([...job.baseSelection,...base.objects.filter(item=>drawingHitsRect(base,item.id,rect)).map(item=>item.id)])]);return;}
    if(job.kind==='pan'){show({...base,view:{...job.before.view,cx:job.before.view.cx-(position.x-job.start.x)/job.before.view.scale,cy:job.before.view.cy+(position.y-job.start.y)/job.before.view.scale}},true);return;}
    if(job.kind==='group'){const start=toWorld(job.start,job.before.view),end=toWorld(position,job.before.view),delta={x:end.x-start.x,y:end.y-start.y};if(job.before.snap){delta.x=Math.round(delta.x);delta.y=Math.round(delta.y);}show(moveDrawingObjects(job.before,job.ids,delta),true);return;}
    const world=toWorld(position,job.before.view);show({...base,objects:base.objects.map(item=>item.id===job.id&&item.type==='freehand'&&item.points.length<1500&&distance(item.points.at(-1)!,world)>1/base.view.scale?{...item,points:[...item.points,world]}:item)},true);
  }
  function up(event:ReactPointerEvent<SVGSVGElement>,cancel=false){
    const job=drag.current;if(!job)return;drag.current=null;svg.current?.releasePointerCapture?.(event.pointerId);setHover(null);
    if(cancel){show(job.before,true);setSelected(job.baseSelection);setMarquee(null);return;}
    if(job.kind==='marquee'){setMarquee(null);return;}
    if(job.kind==='freehand'){
      const stroke=sceneRef.current.objects.find(item=>item.id===job.id);if(stroke?.type==='freehand'){
        if(stroke.points.length<2){show(job.before,true);setSelected([]);return;}
        const base=sceneRef.current,target=findDrawingSnap({...base,objects:base.objects.filter(item=>item.id!==stroke.id)},localPosition(event.clientX,event.clientY),snapRadius());
        if(target){const anchor=sharedPoint(target),end=target.pointId??anchor?.id;if(!anchor||base.objects.length<300)show({...base,objects:[...base.objects.map(item=>item.id===stroke.id?{...stroke,end}:item),...(anchor?[anchor]:[])]},true);}
      }
    }
    show(sceneRef.current,false,job.before);
  }

  function changeStyle(changes:Partial<DrawingStyle>){setStyle(current=>({...current,...changes}));if(selected.length)show(styleDrawingObjects(sceneRef.current,selected,changes));}
  function addPoint(){const x=Number(pointX),y=Number(pointY);if(!pointX.trim()||!pointY.trim()||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e6||Math.abs(y)>1e6){setError('Enter finite coordinates between −1,000,000 and 1,000,000.');return;}const item=makePoint({x,y});if(item.type==='point'&&pointName.trim())item.label=pointName.trim().slice(0,24);if(append([item])){setPointName('');chooseTool('select');}}
  function updateEquation(row:DrawingEquation){const base=sceneRef.current;if(!base.objects.some(item=>item.id===row.id)){if(base.objects.filter(item=>item.type==='equation').length>=16||base.objects.length>=300){setError('Use up to 16 expression lines and 300 drawing objects.');return;}show({...base,objects:[...base.objects,row]});}else show({...base,objects:base.objects.map(item=>item.id===row.id?row:item)});}
  async function use(){if(!svg.current||working||!hasContent)return;const controller=new AbortController();operation.current=controller;setWorking(true);setError('');try{const data=await exportDrawing(svg.current,controller.signal);controller.signal.throwIfAborted();await onUse({name:(name.trim()||'My illustration').replace(/\.png$/i,'').slice(0,116)+'.png',data});}catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not add this illustration.');}finally{if(operation.current===controller){operation.current=null;setWorking(false);}}}
  const info=tools.find(item=>item.id===tool)!;
  const percent=scene.view.scale/45*100,zoomLabel=percent>=1?`${Math.round(percent)}%`:`${Number(percent.toPrecision(2))}%`;
  return <div className="modal-backdrop drawing-backdrop" inert={suspended}><section ref={dialog} className={`drawing-dialog${coordinates?' coordinate-drawing':''}${scene.mode?'':' choosing-drawing-mode'}`} role="dialog" aria-modal="true" aria-labelledby="drawing-title">
    <header className="drawing-header"><h2 id="drawing-title">Draw an illustration</h2>{scene.mode&&<><div className="drawing-mode-switch" role="group" aria-label="Drawing mode"><button type="button" aria-pressed={!coordinates} disabled={working} onClick={()=>chooseMode('blank')}>Blank canvas</button><button type="button" aria-pressed={coordinates} disabled={working} onClick={()=>chooseMode('coordinates')}>Coordinate plane</button></div><button type="button" className="drawing-mobile-tools" aria-expanded={toolboxOpen} aria-controls="drawing-tools-sidebar" onClick={()=>setToolboxOpen(value=>!value)}>Tools {toolboxOpen?'▴':'▾'}</button></>}<button ref={close} type="button" aria-label="Close drawing" disabled={working} onClick={onClose}>✕</button></header>
    {!scene.mode?<div className="drawing-mode-choice"><p>Choose your drawing space</p><div><button type="button" className="drawing-mode-card" aria-label="Start with blank canvas" onClick={()=>chooseMode('blank')}><span aria-hidden="true">△ ○</span><strong>Blank canvas</strong><small>Draw a geometric figure on a clean page.</small></button><button type="button" className="drawing-mode-card" aria-label="Start with coordinate plane" onClick={()=>chooseMode('coordinates')}><span aria-hidden="true">x · y</span><strong>Coordinate plane</strong><small>Place exact points and enter mathematical equations.</small></button></div></div>:<div className="drawing-body"><aside id="drawing-tools-sidebar" data-open={toolboxOpen} className="drawing-sidebar" aria-label="Drawing tools">
      {coordinates&&<><div className="drawing-plane-options drawing-plane-options-top"><label><input type="checkbox" checked={scene.snap} disabled={working} onChange={event=>show({...scene,snap:event.target.checked})}/>Snap to grid</label><label><input type="checkbox" checked={scene.grid} disabled={working} onChange={event=>show({...scene,grid:event.target.checked})}/>Grid</label><label><input type="checkbox" checked={scene.axes} disabled={working} onChange={event=>show({...scene,axes:event.target.checked})}/>Axes</label></div><DrawingEquations rows={equationRows} prepared={prepared} selected={selected} disabled={working} onUpdate={updateEquation} onSelect={id=>setSelected([id])} onDelete={id=>{show(deleteDrawingObjects(sceneRef.current,[id]));setSelected(current=>current.filter(value=>value!==id));}}/></>}
      <details className="drawing-geometry-tools" open={!coordinates}><summary>Geometry tools</summary><div className="drawing-tool-grid">{tools.map(item=><button type="button" key={item.id} aria-pressed={tool===item.id} title={item.hint} disabled={working} onClick={()=>chooseTool(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</div></details>
      {coordinates&&<><details className="drawing-coordinate-tools"><summary>Place a point by coordinates</summary><form onSubmit={event=>{event.preventDefault();addPoint();}}><label>Name (optional)<input aria-label="Point name" value={pointName} maxLength={24} onChange={event=>setPointName(event.target.value)} disabled={working}/></label><div className="drawing-coordinate-row"><label>x<input aria-label="Point x" inputMode="decimal" value={pointX} onChange={event=>setPointX(event.target.value)} disabled={working}/></label><label>y<input aria-label="Point y" inputMode="decimal" value={pointY} onChange={event=>setPointY(event.target.value)} disabled={working}/></label></div><button type="submit" disabled={working}>Add point</button></form></details></>}
      <div className="drawing-style"><SelectMenu label="Line width" value={String(currentStyle.width)} disabled={working} options={[{value:'1.5',label:'Fine'},{value:'2',label:'Regular'},{value:'3.5',label:'Bold'}]} onChange={value=>changeStyle({width:Number(value)})}/><div className="drawing-colors" role="group" aria-label="Drawing color">{[['ink','Ink'],['#3578b1','Blue'],['#b75478','Rose'],['#a07824','Ochre']].map(([color,title])=><button type="button" key={color} title={title} aria-label={`Use ${title.toLowerCase()} stroke`} aria-pressed={selectedObjects.length?selectedObjects.every(item=>item.style.color===color):style.color===color} disabled={working} style={{'--swatch':color==='ink'?'var(--drawing-ink)':color} as React.CSSProperties} onClick={()=>changeStyle({color})}/>)}</div></div>
      {tool==='label'&&<label>Label text<input aria-label="Drawing label text" value={label} maxLength={120} disabled={working} onChange={event=>setLabel(event.target.value)}/></label>}
      {object&&object.type!=='equation'&&<section className="drawing-inspector" aria-label="Selected drawing object"><strong>{object.type==='point'?`Point ${object.label}`:object.type==='function'?'Function graph':object.type[0].toUpperCase()+object.type.slice(1)}</strong>{object.type==='function'&&<><MathInput value={object.latex??object.expression} readOnly compact label="Selected function equation"/>{object.offset&&(object.offset.x||object.offset.y)?<small>Translation: ({number(object.offset.x)}, {number(object.offset.y)})</small>:null}</>}{object.type==='point'&&<PointInspector key={object.id} object={object} scene={scene} coordinates={coordinates} disabled={working} onChange={changes=>show({...sceneRef.current,objects:sceneRef.current.objects.map(item=>item.id===object.id&&item.type==='point'?{...item,...changes}:item)})}/>}</section>}
      <details className="drawing-object-list"><summary>Objects · {scene.objects.length}</summary>{scene.objects.filter(item=>item.type!=='equation').map(item=><button type="button" key={item.id} aria-pressed={selected.includes(item.id)||pending.includes(item.id)} disabled={working} onClick={event=>{if(tool==='select'&&event.shiftKey)setSelected(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id]);else pick(item.id);}}>{item.type==='point'?item.label:item.type==='function'?`Function ${scene.objects.filter(value=>value.type==='function').findIndex(value=>value.id===item.id)+1}`:item.type==='label'?item.text:item.type}</button>)}</details>
    </aside><div className="drawing-workspace"><div className="drawing-canvas-toolbar"><div className="drawing-history-tools"><button type="button" disabled={working||!history.past.length} onClick={undo}>↶ Undo</button><button type="button" disabled={working||!history.future.length} onClick={redo}>↷ Redo</button><button type="button" disabled={working||!scene.objects.length} onClick={()=>{show({...scene,objects:[]});setPending([]);setSelected([]);}}>Clear</button></div><div className="drawing-selection-actions"><span role="status">{selectedObjects.length?`${selectedObjects.length} selected`:'New strokes'}</span><div role="group" aria-label="Stroke style"><button type="button" aria-pressed={solid} disabled={working} onClick={()=>changeStyle({dashed:false})}>Solid ━</button><button type="button" aria-pressed={dashed} disabled={working} onClick={()=>changeStyle({dashed:true})}>Dashed ┄</button></div><button type="button" className="drawing-delete" aria-label="Delete selected objects" disabled={working||!selected.length} onClick={deleteSelected}>Delete</button></div></div>
      <div className="drawing-instruction"><span><strong>{info.label}</strong> · {info.hint}{pending.length>0&&` ${pending.length} chosen.`}</span>{tool==='polygon'&&<button type="button" disabled={working||pending.length<3} onClick={finishPolygon}>Finish polygon</button>}</div>
      <div className="drawing-canvas-shell"><svg ref={svg} className={`drawing-canvas tool-${tool}`} role="img" aria-label="2D drawing canvas" tabIndex={0} viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" onPointerDown={down} onPointerMove={move} onPointerLeave={()=>{if(!drag.current)setHover(null);}} onPointerUp={event=>up(event)} onPointerCancel={event=>up(event,true)} onKeyDown={event=>{if(event.key==='Enter'&&tool==='polygon'&&pending.length>=3){event.preventDefault();finishPolygon();}}}>
        <DrawingArtwork scene={scene} selected={selected}/><g data-ui="true" pointerEvents="none">{pending.map(id=>{const point=pointPosition(scene,id);if(!point)return null;const p=toScreen(point,scene.view);return <circle key={id} cx={p.x} cy={p.y} r="11" fill="none" stroke="var(--drawing-selection)" strokeWidth="2"/>;})}{hover&&(()=>{const p=toScreen(hover.position,scene.view);return <g className="drawing-snap-preview" data-snap-kind={hover.kind}><circle cx={p.x} cy={p.y} r="10" fill="var(--drawing-bg)" fillOpacity=".75" stroke="var(--drawing-selection)" strokeWidth="2"/><circle cx={p.x} cy={p.y} r="3" fill="var(--drawing-selection)"/><text x={p.x+14} y={p.y-13} fontSize="12" fill="var(--drawing-selection)" stroke="var(--drawing-bg)" strokeWidth="3" paintOrder="stroke">{hover.kind==='point'?'Shared point':hover.kind==='intersection'?'Intersection':'Point on path'}</text></g>;})()}{marquee&&<rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="var(--drawing-selection)" fillOpacity=".10" stroke="var(--drawing-selection)" strokeWidth="1.5" strokeDasharray="7 4"/>}</g>
      </svg></div>
      <div className="drawing-view-toolbar"><span>This visible frame will be added as the image.</span><div className="drawing-zoom-tools"><button type="button" aria-label="Zoom drawing out" disabled={working} onClick={()=>show({...scene,view:zoomDrawing(scene.view,.8)})}>−</button><output>{zoomLabel}</output><button type="button" aria-label="Zoom drawing in" disabled={working} onClick={()=>show({...scene,view:zoomDrawing(scene.view,1.25)})}>+</button><button type="button" disabled={working} onClick={()=>show({...scene,view:{...scene.view,cx:0,cy:0,scale:45}})}>Reset view</button><button type="button" disabled={working||!scene.objects.length} onClick={()=>show({...scene,view:fitDrawingView(scene)})}>Fit drawing</button></div></div>
      {error&&<p className="notice error drawing-error" role="alert">{error}</p>}
    </div></div>}
    <footer className="drawing-footer"><label>Image name<input aria-label="Drawing image name" maxLength={116} value={name} disabled={working} onChange={event=>setName(event.target.value)}/></label><button type="button" disabled={working} onClick={onClose}>Close</button><button type="button" className="primary" disabled={working||!scene.mode||!hasContent} onClick={()=>void use()}>{working?'Adding…':'Add to illustrations'}</button></footer>
  </section></div>;
}
function PointInspector({object,scene,disabled,onChange,coordinates}:{object:Extract<DrawingObject,{type:'point'}>;scene:DrawingScene;disabled:boolean;coordinates:boolean;onChange:(changes:Partial<Extract<DrawingObject,{type:'point'}>>)=>void}){
  const point=pointPosition(scene,object.id),[label,setLabel]=useState(object.label),[x,setX]=useState(String(object.x)),[y,setY]=useState(String(object.y)),[error,setError]=useState('');
  useEffect(()=>{setX(String(number(object.x)));setY(String(number(object.y)));},[object.x,object.y]);
  return <form onSubmit={event=>{event.preventDefault();const nx=Number(x),ny=Number(y);if(!label.trim()||coordinates&&!object.derived&&(!x.trim()||!y.trim()||!Number.isFinite(nx)||!Number.isFinite(ny)||Math.abs(nx)>1e6||Math.abs(ny)>1e6)){setError('Enter a name and valid coordinates.');return;}setError('');onChange({label:label.trim(),...(coordinates&&!object.derived?{x:nx,y:ny}:{})});}}><label>Point label<input aria-label="Selected point label" value={label} maxLength={24} disabled={disabled} onChange={event=>setLabel(event.target.value)}/></label>{object.derived?<p>{!point?'Construction is currently undefined.':coordinates?`(${number(point.x)}, ${number(point.y)})`:'Constructed point'}<br/><small>Follows its defining objects.</small></p>:coordinates?<div className="drawing-coordinate-row"><label>x<input aria-label="Selected point x" value={x} inputMode="decimal" disabled={disabled} onChange={event=>setX(event.target.value)}/></label><label>y<input aria-label="Selected point y" value={y} inputMode="decimal" disabled={disabled} onChange={event=>setY(event.target.value)}/></label></div>:null}<button type="submit" disabled={disabled}>Apply point</button>{error&&<small role="alert">{error}</small>}</form>;
}
