import {useEffect,useReducer,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {BOARD_WIDTH,BOARD_HEIGHT,defaultDrawingStyle,deleteDrawingObject,distance,drawingHistory,emptyDrawing,fitDrawingView,intersections,lineGeometry,circleGeometry,nextPointLabel,pointPosition,selectionRect,snapDrawingPoint,toScreen,toWorld,zoomDrawing,type DrawingObject,type DrawingScene,type DrawingStyle,type Rect,type Vec} from '../drawing';
import {compileDrawingFunction} from '../drawing-expression';
import {exportDrawing} from '../drawing-export';
import {lockBodyScroll} from '../scroll-lock';
import {DrawingArtwork} from './DrawingArtwork';
import {SelectMenu} from './SelectMenu';
import '../drawing.css';
type Tool='select'|'pan'|'point'|'segment'|'line'|'ray'|'vector'|'midpoint'|'circle'|'parallel'|'perpendicular'|'intersection'|'polygon'|'rectangle'|'angle'|'freehand'|'label'|'crop';
const tools:{id:Tool;label:string;icon:string;hint:string}[]=[
  {id:'select',label:'Select / move',icon:'↖',hint:'Select an object. Drag a free point or label to move it.'},{id:'pan',label:'Pan',icon:'↔',hint:'Drag the canvas to move the view. Scroll to zoom.'},
  {id:'point',label:'Point',icon:'•',hint:'Click to place a point. Use Coordinates for exact placement.'},{id:'midpoint',label:'Midpoint',icon:'M',hint:'Choose two existing points. The midpoint follows them.'},
  {id:'segment',label:'Segment',icon:'╱',hint:'Choose or place two endpoints.'},{id:'line',label:'Line',icon:'⟷',hint:'Choose or place two points on the infinite line.'},
  {id:'ray',label:'Ray',icon:'⟶',hint:'Choose the start, then a point in the direction of the ray.'},{id:'vector',label:'Vector',icon:'→',hint:'Choose or place the start and end.'},
  {id:'circle',label:'Circle',icon:'○',hint:'Choose or place the center, then a point on the circle.'},{id:'parallel',label:'Parallel',icon:'∥',hint:'Choose a line or segment, then a point for the parallel line.'},
  {id:'perpendicular',label:'Perpendicular',icon:'⊥',hint:'Choose a line or segment, then a point for the perpendicular.'},{id:'intersection',label:'Intersection',icon:'⋂',hint:'Choose two lines, segments, rays or circles.'},
  {id:'polygon',label:'Polygon',icon:'△',hint:'Choose vertices, then click the first vertex or Finish polygon.'},{id:'rectangle',label:'Rectangle',icon:'▭',hint:'Click two opposite corners.'},
  {id:'angle',label:'Angle',icon:'∠',hint:'Choose three existing points: arm, vertex, arm.'},{id:'freehand',label:'Freehand',icon:'〰',hint:'Drag to draw a freehand stroke.'},
  {id:'label',label:'Text label',icon:'T',hint:'Enter label text below, then click where it belongs.'},{id:'crop',label:'Select area',icon:'▧',hint:'Drag around the part to add to Illustrations.'}
];
interface Props {initialScene?:DrawingScene;onScene:(scene:DrawingScene)=>void;onClose:()=>void;onUse:(image:{name:string;data:string})=>Promise<boolean>;suspended:boolean}
interface Drag {kind:'point'|'label'|'pan'|'freehand'|'crop';start:Vec;before:DrawingScene;id?:string;cropBefore:Rect|null}
const uid=()=>crypto.randomUUID();
const number=(value:number)=>Number(value.toFixed(5));
export function IllustrationDrawing({initialScene,onScene,onClose,onUse,suspended}:Props){
  const [history,dispatch]=useReducer(drawingHistory,{scene:initialScene??emptyDrawing(),past:[],future:[]}),{scene}=history;
  const sceneRef=useRef(scene);sceneRef.current=scene;
  const [toolboxOpen,setToolboxOpen]=useState(window.innerWidth>700);
  const [tool,setTool]=useState<Tool>('select'),[pending,setPending]=useState<string[]>([]),[selected,setSelected]=useState<string|null>(null);
  const [style,setStyle]=useState<DrawingStyle>({...defaultDrawingStyle}),[crop,setCrop]=useState<Rect|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
  const [expression,setExpression]=useState('x^2 / 4'),[label,setLabel]=useState('Label'),[name,setName]=useState('My illustration');
  const [pointName,setPointName]=useState(''),[pointX,setPointX]=useState('0'),[pointY,setPointY]=useState('0');
  const svg=useRef<SVGSVGElement>(null),dialog=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),drag=useRef<Drag|null>(null),operation=useRef<AbortController|null>(null);
  const state=useRef({suspended,working,onClose,tool,pending,scene,onScene});state.current={suspended,working,onClose,tool,pending,scene,onScene};
  const object=scene.objects.find(item=>item.id===selected),currentStyle=object?.style??style;
  useEffect(()=>onScene(scene),[scene,onScene]);
  useEffect(()=>{const query=window.matchMedia('(max-width:700px)');const update=()=>setToolboxOpen(!query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  function show(next:DrawingScene,preview=false,before?:DrawingScene){sceneRef.current=next;dispatch(preview?{type:'preview',scene:next}:{type:'commit',scene:next,before});}
  function chooseTool(next:Tool){setTool(next);setPending([]);setError('');if(window.innerWidth<=700)setToolboxOpen(false);}
  function undo(){drag.current=null;setPending([]);setSelected(null);setCrop(null);dispatch({type:'undo'});}
  function redo(){drag.current=null;setPending([]);setSelected(null);setCrop(null);dispatch({type:'redo'});}
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,release=lockBodyScroll();close.current?.focus();
    const handle=(event:KeyboardEvent)=>{
      if(state.current.suspended||event.defaultPrevented)return;
      if(event.target instanceof Element&&event.target.closest('[role="listbox"],.symbol-browser'))return;
      const input=event.target instanceof Element&&!!event.target.closest('input,textarea,[contenteditable="true"]');
      if(event.key==='Escape'&&!state.current.working){event.preventDefault();if(state.current.pending.length){setPending([]);return;}if(state.current.tool!=='select'){setTool('select');return;}state.current.onClose();return;}
      if(!input&&!state.current.working){
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();return;}
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return;}
      }
      if(event.key!=='Tab')return;const nodes=[...dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')??[]].filter(node=>!node.closest('details:not([open])'));
      const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handle);return()=>{operation.current?.abort();operation.current=null;document.removeEventListener('keydown',handle);release();previous?.focus();};
  },[]);
  function localPosition(clientX:number,clientY:number):Vec{
    const element=svg.current!,matrix=element.getScreenCTM?.();if(matrix){const point=element.createSVGPoint();point.x=clientX;point.y=clientY;const result=point.matrixTransform(matrix.inverse());return {x:result.x,y:result.y};}
    const bounds=element.getBoundingClientRect();return {x:(clientX-bounds.left)/bounds.width*BOARD_WIDTH,y:(clientY-bounds.top)/bounds.height*BOARD_HEIGHT};
  }
  const wheelHandler=useRef<(event:WheelEvent)=>void>(()=>{});
  wheelHandler.current=event=>{if(state.current.working||state.current.suspended)return;event.preventDefault();setCrop(null);show({...sceneRef.current,view:zoomDrawing(sceneRef.current.view,event.deltaY>0?.9:1.1,localPosition(event.clientX,event.clientY))});};
  useEffect(()=>{const element=svg.current;const handle=(event:WheelEvent)=>wheelHandler.current(event);element?.addEventListener('wheel',handle,{passive:false});return()=>element?.removeEventListener('wheel',handle);},[]);
  function append(items:DrawingObject[],base=sceneRef.current){if(base.objects.length+items.length>300){setError('This drawing supports up to 300 objects.');return false;}show({...base,objects:[...base.objects,...items]});setSelected(items.at(-1)?.id??null);setError('');return true;}
  function makePoint(position:Vec,objects=sceneRef.current.objects):DrawingObject{return {id:uid(),type:'point',label:nextPointLabel(objects),...position,style:{...style}};}
  function nearby(position:Vec):string|null{let result:string|null=null,best=14;for(const item of sceneRef.current.objects)if(item.type==='point'){const point=pointPosition(sceneRef.current,item.id);if(point){const d=distance(toScreen(point,sceneRef.current.view),position);if(d<best){best=d;result=item.id;}}}return result;}
  function finishPolygon(){if(pending.length<3){setError('Choose at least three vertices.');return;}if(append([{id:uid(),type:'polygon',points:pending,style:{...style}}]))setPending([]);}
  function pick(id:string){
    const base=sceneRef.current,hit=base.objects.find(item=>item.id===id);if(!hit)return;
    if(tool==='select'){setSelected(id);return;}
    if(tool==='intersection'){
      if(!lineGeometry(base,id)&&!circleGeometry(base,id)){setError('Choose a line, segment, ray or circle.');return;}
      if(!pending.length){setPending([id]);setSelected(id);return;}if(pending[0]===id)return;
      const points=intersections(base,pending[0],id);if(!points.length){setError('These objects do not have a unique visible intersection.');return;}
      const items:DrawingObject[]=[];for(const [branch,position] of points.entries()){const item=makePoint(position,[...base.objects,...items]);if(item.type==='point')item.derived={kind:'intersection',a:pending[0],b:id,branch};items.push(item);}append(items);setPending([]);return;
    }
    if(tool==='parallel'||tool==='perpendicular'){
      if(!pending.length){if(!lineGeometry(base,id)){setError('Choose a line or segment first.');return;}setPending([id]);setSelected(id);return;}
      if(hit.type!=='point'){setError('Choose a point for the new line.');return;}
      append([{id:uid(),type:tool,line:pending[0],point:id,style:{...style}}]);setPending([]);return;
    }
    if(hit.type!=='point'){setError('Choose a point.');return;}
    if(tool==='point'){setSelected(id);return;}
    if(tool==='polygon'&&pending[0]===id&&pending.length>=3){finishPolygon();return;}
    if(pending.includes(id)){setError('Choose a different point.');return;}
    const points=[...pending,id];setSelected(id);setError('');
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
    if(working||suspended||event.button!==0)return;const position=localPosition(event.clientX,event.clientY);if(position.x<0||position.y<0||position.x>BOARD_WIDTH||position.y>BOARD_HEIGHT)return;
    event.preventDefault();svg.current?.focus({preventScroll:true});svg.current?.setPointerCapture?.(event.pointerId);const base=sceneRef.current,world=snapDrawingPoint(toWorld(position,base.view),base),hit=(event.target as Element).closest('[data-object-id]')?.getAttribute('data-object-id')??null,point=nearby(position);
    if(tool==='pan'){setCrop(null);drag.current={kind:'pan',start:position,before:base,cropBefore:crop};return;}
    if(tool==='crop'){drag.current={kind:'crop',start:position,before:base,cropBefore:crop};setCrop(selectionRect(position,position));return;}
    if(tool==='freehand'){
      if(base.objects.length>=300){setError('This drawing supports up to 300 objects.');return;}const item:DrawingObject={id:uid(),type:'freehand',points:[world],style:{...style}};show({...base,objects:[...base.objects,item]},true);setSelected(item.id);drag.current={kind:'freehand',start:position,before:base,id:item.id,cropBefore:crop};return;
    }
    if(tool==='label'){if(!label.trim()){setError('Enter label text first.');return;}append([{id:uid(),type:'label',at:world,text:label.trim().slice(0,120),style:{...style}}]);return;}
    if(tool==='select'){
      const id=point??hit;setSelected(id);if(!id)return;const item=base.objects.find(object=>object.id===id)!;
      if(item.type==='point'&&!item.derived)drag.current={kind:'point',start:position,before:base,id,cropBefore:crop};
      else if(item.type==='label')drag.current={kind:'label',start:position,before:base,id,cropBefore:crop};
      return;
    }
    if(tool==='intersection'||((tool==='parallel'||tool==='perpendicular')&&!pending.length)){if(hit)pick(hit);else setError('Choose an existing line or circle.');return;}
    if(point){pick(point);return;}
    if(tool==='midpoint'||tool==='angle'){setError('Place the defining points first, then choose them.');return;}
    const item=makePoint(world);if(append([item]))pick(item.id);
  }
  function move(event:ReactPointerEvent<SVGSVGElement>){
    const job=drag.current;if(!job)return;const position=localPosition(event.clientX,event.clientY),base=sceneRef.current,world=snapDrawingPoint(toWorld(position,job.before.view),job.before);
    if(job.kind==='crop'){setCrop(selectionRect(job.start,position));return;}
    if(job.kind==='pan'){show({...base,view:{...job.before.view,cx:job.before.view.cx-(position.x-job.start.x)/job.before.view.scale,cy:job.before.view.cy+(position.y-job.start.y)/job.before.view.scale}},true);return;}
    const objects=base.objects.map(item=>{
      if(item.id!==job.id)return item;if(job.kind==='point'&&item.type==='point')return {...item,x:world.x,y:world.y};
      if(job.kind==='label'&&item.type==='label')return {...item,at:world};
      if(job.kind==='freehand'&&item.type==='freehand'&&item.points.length<1500&&distance(item.points.at(-1)!,world)>1/base.view.scale)return {...item,points:[...item.points,world]};return item;
    });show({...base,objects},true);
  }
  function up(event:ReactPointerEvent<SVGSVGElement>,cancel=false){const job=drag.current;if(!job)return;drag.current=null;svg.current?.releasePointerCapture?.(event.pointerId);if(cancel){show(job.before,true);setCrop(job.cropBefore);return;}if(job.kind==='freehand'&&sceneRef.current.objects.some(item=>item.id===job.id&&item.type==='freehand'&&item.points.length<2)){show(job.before,true);setSelected(null);return;}if(job.kind!=='crop')show(sceneRef.current,false,job.before);}
  function changeStyle(changes:Partial<DrawingStyle>){setStyle(current=>({...current,...changes}));if(object)show({...sceneRef.current,objects:sceneRef.current.objects.map(item=>item.id===object.id?{...item,style:{...item.style,...changes}}:item)});}
  function deleteSelected(){if(!selected)return;show(deleteDrawingObject(sceneRef.current,selected));setSelected(null);setPending([]);}
  function addPoint(){const x=Number(pointX),y=Number(pointY);if(!pointX.trim()||!pointY.trim()||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e6||Math.abs(y)>1e6){setError('Enter finite coordinates between −1,000,000 and 1,000,000.');return;}const item=makePoint({x,y});if(item.type==='point'&&pointName.trim())item.label=pointName.trim().slice(0,24);if(append([item])){setPointName('');chooseTool('select');}}
  function addFunction(){try{compileDrawingFunction(expression);if(scene.objects.filter(item=>item.type==='function').length>=12)throw new Error('This drawing supports up to 12 function graphs.');append([{id:uid(),type:'function',expression:expression.trim(),style:{...style}}]);}catch(reason){setError(reason instanceof Error?reason.message:'Check the function.');}}
  async function use(){if(!svg.current||working||!scene.objects.length)return;const controller=new AbortController();operation.current=controller;setWorking(true);setError('');try{const data=await exportDrawing(svg.current,crop,controller.signal);controller.signal.throwIfAborted();await onUse({name:(name.trim()||'My illustration').replace(/\.png$/i,'').slice(0,116)+'.png',data});}catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not add this illustration.');}finally{if(operation.current===controller){operation.current=null;setWorking(false);}}}
  const info=tools.find(item=>item.id===tool)!;
  return <div className="modal-backdrop drawing-backdrop" inert={suspended}><section ref={dialog} className="drawing-dialog" role="dialog" aria-modal="true" aria-labelledby="drawing-title">
    <header className="drawing-header"><div><p className="eyebrow">DRAW · SELECT AREA · ADD</p><h2 id="drawing-title">Draw an illustration</h2><p>Build your figure, select the part you need, then add it to this exercise.</p></div><button ref={close} type="button" aria-label="Close drawing" disabled={working} onClick={onClose}>✕</button></header>
    <div className="drawing-body"><button type="button" className="drawing-mobile-tools" aria-expanded={toolboxOpen} aria-controls="drawing-tools-sidebar" onClick={()=>setToolboxOpen(value=>!value)}>Tools &amp; coordinates · {info.label} {toolboxOpen?'▴':'▾'}</button><aside id="drawing-tools-sidebar" data-open={toolboxOpen} className="drawing-sidebar" aria-label="Drawing tools"><div className="drawing-tool-grid">{tools.filter(item=>item.id!=='crop').map(item=><button type="button" key={item.id} aria-pressed={tool===item.id} title={item.hint} disabled={working} onClick={()=>chooseTool(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</div>
      <div className="drawing-plane-options"><label><input type="checkbox" checked={scene.axes} disabled={working} onChange={event=>show({...scene,axes:event.target.checked})}/>Coordinate axes</label><label><input type="checkbox" checked={scene.grid} disabled={working} onChange={event=>show({...scene,grid:event.target.checked})}/>Grid</label><label><input type="checkbox" checked={scene.snap} disabled={working} onChange={event=>show({...scene,snap:event.target.checked})}/>Snap to grid</label></div>
      <div className="drawing-style"><SelectMenu label="Stroke style" value={currentStyle.dashed?'dashed':'solid'} disabled={working} options={[{value:'solid',label:'Solid'},{value:'dashed',label:'Dashed'}]} onChange={value=>changeStyle({dashed:value==='dashed'})}/><SelectMenu label="Line width" value={String(currentStyle.width)} disabled={working} options={[{value:'1.5',label:'Fine'},{value:'2',label:'Regular'},{value:'3.5',label:'Bold'}]} onChange={value=>changeStyle({width:Number(value)})}/><div className="drawing-colors" role="group" aria-label="Drawing color">{[['ink','Ink'],['#3578b1','Blue'],['#b75478','Rose'],['#a07824','Ochre']].map(([color,title])=><button type="button" key={color} title={title} aria-label={`Use ${title.toLowerCase()} stroke`} aria-pressed={currentStyle.color===color} disabled={working} style={{'--swatch':color==='ink'?'var(--drawing-ink)':color} as React.CSSProperties} onClick={()=>changeStyle({color})}/>)}</div></div>
      {tool==='label'&&<label>Label text<input aria-label="Drawing label text" value={label} maxLength={120} disabled={working} onChange={event=>setLabel(event.target.value)}/></label>}
      <details className="drawing-coordinate-tools"><summary>Place a point by coordinates</summary><form onSubmit={event=>{event.preventDefault();addPoint();}}><label>Name (optional)<input aria-label="Point name" value={pointName} maxLength={24} onChange={event=>setPointName(event.target.value)} disabled={working}/></label><div className="drawing-coordinate-row"><label>x<input aria-label="Point x" inputMode="decimal" value={pointX} onChange={event=>setPointX(event.target.value)} disabled={working}/></label><label>y<input aria-label="Point y" inputMode="decimal" value={pointY} onChange={event=>setPointY(event.target.value)} disabled={working}/></label></div><button type="submit" disabled={working}>Add point</button></form></details>
      <details className="drawing-function-tools"><summary>Plot a function</summary><form onSubmit={event=>{event.preventDefault();addFunction();}}><label>y = f(x)<input aria-label="Function expression" value={expression} maxLength={300} disabled={working} onChange={event=>setExpression(event.target.value)} placeholder="x^2, sin(x), sqrt(x)"/></label><small>Use x, pi, + − * / ^ and functions such as sin, cos, sqrt, abs, ln or log. Angles are in radians.</small><button type="submit" disabled={working}>Add function</button></form></details>
      {object&&<section className="drawing-inspector" aria-label="Selected drawing object"><strong>{object.type==='point'?`Point ${object.label}`:object.type==='function'?`y = ${object.expression}`:object.type[0].toUpperCase()+object.type.slice(1)}</strong>{object.type==='point'&&<PointInspector key={object.id} object={object} scene={scene} disabled={working} onChange={changes=>show({...sceneRef.current,objects:sceneRef.current.objects.map(item=>item.id===object.id&&item.type==='point'?{...item,...changes}:item)})}/>}<button type="button" className="drawing-delete" disabled={working} onClick={deleteSelected}>Delete selected</button><small>Dependent constructions are removed together.</small></section>}
      <details className="drawing-object-list"><summary>Objects · {scene.objects.length}</summary>{scene.objects.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id||pending.includes(item.id)} disabled={working} onClick={()=>pick(item.id)}>{item.type==='point'?item.label:item.type==='function'?`y = ${item.expression}`:item.type==='label'?item.text:item.type}</button>)}</details>
    </aside><div className="drawing-workspace"><div className="drawing-canvas-toolbar"><div className="drawing-history-tools"><button type="button" disabled={working||!history.past.length} onClick={undo}>↶ Undo</button><button type="button" disabled={working||!history.future.length} onClick={redo}>↷ Redo</button></div><button type="button" disabled={working||!scene.objects.length} onClick={()=>{show({...scene,objects:[]});setPending([]);setSelected(null);setCrop(null);}}>Clear canvas</button><div className="drawing-zoom-tools"><button type="button" aria-label="Zoom drawing out" disabled={working} onClick={()=>{setCrop(null);show({...scene,view:zoomDrawing(scene.view,.8)});}}>−</button><span>{Math.round(scene.view.scale/45*100)}%</span><button type="button" aria-label="Zoom drawing in" disabled={working} onClick={()=>{setCrop(null);show({...scene,view:zoomDrawing(scene.view,1.25)});}}>+</button><button type="button" disabled={working} onClick={()=>{setCrop(null);show({...scene,view:emptyDrawing().view});}}>Reset view</button><button type="button" disabled={working||!scene.objects.length} onClick={()=>{setCrop(null);show({...scene,view:fitDrawingView(scene)});}}>Fit drawing</button></div></div>
      <p className="drawing-instruction" role="status"><strong>{info.label}</strong> · {info.hint}{pending.length>0&&<span> {pending.length} chosen.</span>}</p>{tool==='polygon'&&<button type="button" className="drawing-finish" disabled={working||pending.length<3} onClick={finishPolygon}>Finish polygon</button>}
      <div className="drawing-canvas-shell"><svg ref={svg} className={`drawing-canvas tool-${tool}`} role="img" aria-label="2D drawing canvas" tabIndex={0} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} onPointerDown={down} onPointerMove={move} onPointerUp={event=>up(event)} onPointerCancel={event=>up(event,true)} onKeyDown={event=>{if((event.key==='Delete'||event.key==='Backspace')&&selected&&!working){event.preventDefault();deleteSelected();}if(event.key==='Enter'&&tool==='polygon'&&pending.length>=3){event.preventDefault();finishPolygon();}}}>
        <DrawingArtwork scene={scene} selected={selected}/>
        <g data-ui="true" pointerEvents="none">{pending.map(id=>{const point=pointPosition(scene,id);if(!point)return null;const p=toScreen(point,scene.view);return <circle key={id} cx={p.x} cy={p.y} r="11" fill="none" stroke="#369b7a" strokeWidth="2"/>;})}{crop&&<><path d={`M0 0H${BOARD_WIDTH}V${BOARD_HEIGHT}H0Z M${crop.x} ${crop.y}h${crop.width}v${crop.height}h-${crop.width}Z`} fill="#172d2290" fillRule="evenodd"/><rect x={crop.x} y={crop.y} width={crop.width} height={crop.height} fill="none" stroke="#369b7a" strokeWidth="2" strokeDasharray="8 5"/></>}</g>
      </svg></div>
      <div className="drawing-export-options"><button type="button" className={tool==='crop'?'primary':''} aria-label="Select area" aria-pressed={tool==='crop'} disabled={working} onClick={()=>chooseTool('crop')}>▧ Select area</button>{crop?<><span>{Math.round(crop.width)} × {Math.round(crop.height)} selected</span><button type="button" disabled={working} onClick={()=>{setCrop(null);chooseTool('select');}}>Use whole canvas</button></>:<span>Whole canvas will be added. Select an area to crop.</span>}<label>Image name<input aria-label="Drawing image name" maxLength={116} value={name} disabled={working} onChange={event=>setName(event.target.value)}/></label></div>
      {error&&<p className="notice error" role="alert">{error}</p>}
    </div></div><footer className="drawing-footer"><p>Drawing stays here while you work on this exercise. Add it, then save the exercise to keep the image.</p><button type="button" disabled={working} onClick={onClose}>Close</button><button type="button" className="primary" disabled={working||!scene.objects.length||!!crop&&(crop.width<24||crop.height<24)} onClick={()=>void use()}>{working?'Adding illustration…':'Add to illustrations'}</button></footer>
  </section></div>;
}
function PointInspector({object,scene,disabled,onChange}:{object:Extract<DrawingObject,{type:'point'}>;scene:DrawingScene;disabled:boolean;onChange:(changes:Partial<Extract<DrawingObject,{type:'point'}>>)=>void}){
  const point=pointPosition(scene,object.id),[label,setLabel]=useState(object.label),[x,setX]=useState(String(object.x)),[y,setY]=useState(String(object.y)),[error,setError]=useState('');
  useEffect(()=>{setX(String(number(object.x)));setY(String(number(object.y)));},[object.x,object.y]);
  return <form onSubmit={event=>{event.preventDefault();const nx=Number(x),ny=Number(y);if(!label.trim()||!object.derived&&(!x.trim()||!y.trim()||!Number.isFinite(nx)||!Number.isFinite(ny)||Math.abs(nx)>1e6||Math.abs(ny)>1e6)){setError('Enter a name and valid coordinates.');return;}setError('');onChange({label:label.trim(),...(!object.derived?{x:nx,y:ny}:{})});}}><label>Point label<input aria-label="Selected point label" value={label} maxLength={24} disabled={disabled} onChange={event=>setLabel(event.target.value)}/></label>{object.derived?<p>{point?`(${number(point.x)}, ${number(point.y)})`:'Construction is currently undefined.'}<br/><small>Follows its defining objects.</small></p>:<div className="drawing-coordinate-row"><label>x<input aria-label="Selected point x" value={x} inputMode="decimal" disabled={disabled} onChange={event=>setX(event.target.value)}/></label><label>y<input aria-label="Selected point y" value={y} inputMode="decimal" disabled={disabled} onChange={event=>setY(event.target.value)}/></label></div>}<button type="submit" disabled={disabled}>Apply point</button>{error&&<small role="alert">{error}</small>}</form>;
}
