import {memo,useMemo} from 'react';
import {BOARD_HEIGHT,BOARD_WIDTH,clippedLine,circleGeometry,pointPosition,plotDrawingFunction,toScreen,toWorld,type DrawingScene,type DrawingObject,type Vec} from '../drawing';
const ink=(color:string)=>color==='ink'?'var(--drawing-ink)':color;
const coordinates=(points:Vec[])=>points.map(point=>`${point.x},${point.y}`).join(' ');
const Plot=memo(function Plot({expression,view}:{expression:string;view:DrawingScene['view']}){const paths=useMemo(()=>plotDrawingFunction(expression,view),[expression,view]);return <>{paths.map((points,index)=><polyline key={index} points={coordinates(points)}/>)}</>;});
function Shape({object,scene}:{object:DrawingObject;scene:DrawingScene}){
  const common={stroke:ink(object.style.color),strokeWidth:object.style.width,strokeDasharray:object.style.dashed?'9 6':undefined,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,fill:'none'};
  let drawing:React.ReactNode=null;
  const line=clippedLine(scene,object.id);
  if(line)drawing=<line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} markerEnd={object.type==='vector'?'url(#drawing-arrow)':undefined}/>;
  else if(object.type==='circle'){const circle=circleGeometry(scene,object.id);if(circle){const center=toScreen(circle.center,scene.view);drawing=<circle cx={center.x} cy={center.y} r={circle.radius*scene.view.scale}/>;}}
  else if(object.type==='polygon'){const points=object.points.map(id=>pointPosition(scene,id));if(points.every(Boolean))drawing=<polygon points={coordinates((points as Vec[]).map(point=>toScreen(point,scene.view)))} fill={ink(object.style.color)} fillOpacity=".065"/>;}
  else if(object.type==='freehand')drawing=<polyline points={coordinates(object.points.map(point=>toScreen(point,scene.view)))}/>;
  else if(object.type==='label'){const point=toScreen(object.at,scene.view);drawing=<text x={point.x} y={point.y} fill={ink(object.style.color)} stroke="none" fontSize="20" fontFamily="Georgia,serif">{object.text}</text>;}
  else if(object.type==='function')drawing=<Plot expression={object.expression} view={scene.view}/>;
  else if(object.type==='angle'){
    const a=pointPosition(scene,object.a),b=pointPosition(scene,object.vertex),c=pointPosition(scene,object.b);
    if(a&&b&&c){const vertex=toScreen(b,scene.view),first=toScreen(a,scene.view),last=toScreen(c,scene.view),start=Math.atan2(first.y-vertex.y,first.x-vertex.x);let delta=Math.atan2(last.y-vertex.y,last.x-vertex.x)-start;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
      const radius=Math.min(32,Math.hypot(first.x-vertex.x,first.y-vertex.y)*.35,Math.hypot(last.x-vertex.x,last.y-vertex.y)*.35),x1=vertex.x+radius*Math.cos(start),y1=vertex.y+radius*Math.sin(start),x2=vertex.x+radius*Math.cos(start+delta),y2=vertex.y+radius*Math.sin(start+delta);
      drawing=<><path d={`M${x1} ${y1} A${radius} ${radius} 0 0 ${delta>0?1:0} ${x2} ${y2}`}/><text x={vertex.x+(radius+18)*Math.cos(start+delta/2)} y={vertex.y+(radius+18)*Math.sin(start+delta/2)} textAnchor="middle" dominantBaseline="middle" fill={ink(object.style.color)} stroke="none" fontSize="15">{(Math.abs(delta)*180/Math.PI).toFixed(1)}°</text></>;
    }
  }
  if(object.type==='point'){
    const position=pointPosition(scene,object.id);if(!position)return null;const p=toScreen(position,scene.view);
    return <g data-object-id={object.id}><circle data-ui="true" cx={p.x} cy={p.y} r="12" fill="transparent"/><circle cx={p.x} cy={p.y} r={object.derived?4:4.5} fill={object.derived?'var(--drawing-bg)':ink(object.style.color)} stroke={ink(object.style.color)} strokeWidth="2"/><text x={p.x+9} y={p.y-9} fontFamily="Georgia,serif" fontSize="18" fill={ink(object.style.color)} stroke="var(--drawing-bg)" strokeWidth="3" paintOrder="stroke">{object.label}</text></g>;
  }
  return <g data-object-id={object.id} {...common}><g data-ui="true" stroke="transparent" strokeWidth="16" fill="none">{drawing}</g>{drawing}</g>;
}
export function DrawingArtwork({scene,selected}:{scene:DrawingScene;selected?:string|null}){
  const topLeft=toWorld({x:0,y:0},scene.view),bottomRight=toWorld({x:BOARD_WIDTH,y:BOARD_HEIGHT},scene.view);
  const step=10**Math.ceil(Math.log10(32/scene.view.scale)),xs:number[]=[],ys:number[]=[];
  for(let x=Math.ceil(topLeft.x/step)*step;x<=bottomRight.x;x+=step)xs.push(x);
  for(let y=Math.ceil(bottomRight.y/step)*step;y<=topLeft.y;y+=step)ys.push(y);
  const origin=toScreen({x:0,y:0},scene.view);
  return <><defs><marker id="drawing-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke"/></marker><clipPath id="drawing-board-clip"><rect width={BOARD_WIDTH} height={BOARD_HEIGHT}/></clipPath></defs>
    <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="var(--drawing-bg)"/>
    {scene.grid&&<g stroke="var(--drawing-grid)" strokeWidth="1">{xs.map(x=>{const p=toScreen({x,y:0},scene.view);return <line key={`x${x}`} x1={p.x} y1="0" x2={p.x} y2={BOARD_HEIGHT}/>;})}{ys.map(y=>{const p=toScreen({x:0,y},scene.view);return <line key={`y${y}`} x1="0" y1={p.y} x2={BOARD_WIDTH} y2={p.y}/>;})}</g>}
    {scene.axes&&<g stroke="var(--drawing-axis)" fill="var(--drawing-axis)" strokeWidth="1.3" fontSize="12" fontFamily="system-ui,sans-serif"><line x1="0" y1={origin.y} x2={BOARD_WIDTH} y2={origin.y}/><line x1={origin.x} y1="0" x2={origin.x} y2={BOARD_HEIGHT}/>{xs.filter(x=>Math.abs(x)>1e-8).map(x=>{const p=toScreen({x,y:0},scene.view),y=Math.max(16,Math.min(BOARD_HEIGHT-12,origin.y+17));return <text key={`x${x}`} x={p.x+3} y={y} stroke="none">{Number(x.toPrecision(5))}</text>;})}{ys.filter(y=>Math.abs(y)>1e-8).map(y=>{const p=toScreen({x:0,y},scene.view),x=Math.max(10,Math.min(BOARD_WIDTH-35,origin.x+7));return <text key={`y${y}`} x={x} y={p.y-4} stroke="none">{Number(y.toPrecision(5))}</text>;})}<text x={BOARD_WIDTH-16} y={Math.max(16,Math.min(BOARD_HEIGHT-10,origin.y-8))} stroke="none">x</text><text x={Math.max(10,Math.min(BOARD_WIDTH-20,origin.x+8))} y="16" stroke="none">y</text></g>}
    <g clipPath="url(#drawing-board-clip)">{scene.objects.filter(object=>object.type!=='point').map(object=><Shape key={object.id} scene={scene} object={object}/>)}{scene.objects.filter(object=>object.type==='point').map(object=><Shape key={object.id} scene={scene} object={object}/>)}</g>
    {selected&&<g data-ui="true" pointerEvents="none">{(()=>{const p=pointPosition(scene,selected);if(!p)return null;const screen=toScreen(p,scene.view);return <circle cx={screen.x} cy={screen.y} r="13" fill="none" stroke="#3c9b7d" strokeWidth="2"/>;})()}</g>}
  </>;
}
