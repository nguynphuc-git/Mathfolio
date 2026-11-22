import {useLayoutEffect,useRef,useState} from 'react';
import {keyboardPosition,type Point} from '../floating-keyboard';
import {symbolCategories,type MathSymbol} from '../math-symbols';
const all=symbolCategories.flatMap(category=>category.symbols);
export function SymbolPanel({recent,onInsert,disabled,onClose,targetLabel,position,onPosition,suspended=false}:{recent:string[];onInsert:(symbol:MathSymbol)=>void;disabled?:boolean;onClose:()=>void;targetLabel:string;position:Point|null;onPosition:(point:Point)=>void;suspended?:boolean}) {
  const [viewportHeight,setViewportHeight]=useState(()=>window.visualViewport?.height??window.innerHeight);
  const [category,setCategory]=useState(1),[search,setSearch]=useState('');const panel=useRef<HTMLDivElement>(null);
  const drag=useRef<{pointer:number;start:Point;origin:Point}|null>(null),current=useRef({position,onPosition});current.current={position,onPosition};
  const clamp=(point:Point)=>{
    const viewport=window.visualViewport;
    const offset={x:viewport?.offsetLeft??0,y:viewport?.offsetTop??0};
    const fitted=keyboardPosition({x:point.x-offset.x,y:point.y-offset.y},panel.current?.getBoundingClientRect()??{width:0,height:0},{width:viewport?.width??window.innerWidth,height:viewport?.height??window.innerHeight});
    return {x:fitted.x+offset.x,y:fitted.y+offset.y};
  };
  useLayoutEffect(()=>{const fit=()=>{setViewportHeight(window.visualViewport?.height??window.innerHeight);const bounds=panel.current?.getBoundingClientRect();current.current.onPosition(clamp(current.current.position??{x:bounds?.left??8,y:bounds?.top??8}));};fit();window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);const observer=new ResizeObserver(fit);if(panel.current)observer.observe(panel.current);return()=>{observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit);};},[]);
  function start(event:React.PointerEvent<HTMLElement>){if(event.button!==0||!panel.current)return;event.preventDefault();const bounds=panel.current.getBoundingClientRect();drag.current={pointer:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:{x:bounds.left,y:bounds.top}};event.currentTarget.setPointerCapture(event.pointerId);}
  function move(event:React.PointerEvent<HTMLElement>){const item=drag.current;if(item?.pointer===event.pointerId)onPosition(clamp({x:item.origin.x+event.clientX-item.start.x,y:item.origin.y+event.clientY-item.start.y}));}
  function keys(event:React.KeyboardEvent<HTMLElement>){const offsets:Record<string,Point>={ArrowLeft:{x:-20,y:0},ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20}};const offset=offsets[event.key];if(!offset)return;event.preventDefault();onPosition(clamp({x:(position?.x??8)+offset.x,y:(position?.y??8)+offset.y}));}
  const symbols=(items:MathSymbol[])=><div className="math-keys">{items.map(symbol=><button type="button" key={symbol.label} disabled={disabled} title={symbol.name} aria-label={`Insert ${symbol.label}`} onMouseDown={event=>event.preventDefault()} onClick={()=>onInsert(symbol)}>{symbol.label}</button>)}</div>;
  const matches=all.filter(symbol=>`${symbol.label} ${symbol.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div ref={panel} style={{'--symbol-viewport-height':`${viewportHeight}px`,...(position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:{}),...(suspended?{zIndex:5}:{})} as React.CSSProperties} className="symbol-browser" onPointerDown={event=>{if((event.target as HTMLElement).closest('button'))event.preventDefault();}} onMouseDown={event=>{if((event.target as HTMLElement).closest('button'))event.preventDefault();}} onKeyDown={event=>{if(event.key==='Escape')event.stopPropagation();}} role="region" aria-label="Math symbols">
    <div className="symbol-drawer-heading"><div className="symbol-drag-handle" role="button" tabIndex={0} aria-label="Move math keyboard" title="Drag to move · arrow keys move this panel" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={keys}><span aria-hidden="true">⠿</span><strong>Math symbols</strong></div><button type="button" aria-label="Close symbol keyboard" onClick={onClose}>✕</button></div>
    <p className="keyboard-target" role="status">Typing in: <strong>{targetLabel}</strong></p>
    <input aria-label="Search math symbols" placeholder="Search symbols, e.g. subset or integral" maxLength={60} value={search} onChange={event=>setSearch(event.target.value)}/>
    {!search&&recent.length>0&&<div className="recent-symbols"><small>Recently used</small>{symbols(recent.flatMap(label=>all.find(symbol=>symbol.label===label)??[]))}</div>}
    <div className="symbol-categories" role="group" aria-label="Symbol categories">{symbolCategories.map((item,index)=><button type="button" key={item.name} aria-pressed={category===index} onClick={()=>setCategory(index)}>{item.name}</button>)}</div>
    <div className="symbol-category-content" role="group" aria-label={search?'Search results':symbolCategories[category].name}>{symbols(search?matches:symbolCategories[category].symbols)}{search&&!matches.length&&<p className="subtle">No matching symbols.</p>}</div>
  </div>;
}
