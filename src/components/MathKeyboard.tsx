import { useId, useLayoutEffect, useRef, useState } from 'react';
import { keyboardPosition, type Point } from '../floating-keyboard';
import { commonSymbols, symbolCategories, type MathSymbol } from '../math-symbols';
const allSymbols=symbolCategories.flatMap(category=>category.symbols);
function readRecent():string[]{try{const value:unknown=JSON.parse(localStorage.getItem('mathfolio.recent-symbols')??'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,6):[];}catch{return [];}}
export function MathKeyboard({ onInsert, disabled, notes=false }: { onInsert:(symbol:MathSymbol)=>void; disabled?:boolean; notes?:boolean }) {
  const [expanded,setExpanded]=useState(false); const [category,setCategory]=useState(1); const id=useId();
  const [search,setSearch]=useState(''); const [recent,setRecent]=useState(readRecent);
  const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<Point|null>(null);
  const drag=useRef<{pointer:number;start:Point;origin:Point}|null>(null);
  const clamp=(point:Point)=>keyboardPosition(point,panel.current?.getBoundingClientRect()??{width:0,height:0},{width:window.innerWidth,height:window.innerHeight});
  useLayoutEffect(()=>{
    if(!expanded)return;
    const fit=()=>setPosition(current=>{const bounds=panel.current?.getBoundingClientRect();return clamp(current??{x:bounds?.left??8,y:bounds?.top??8});});
    fit();window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
    const observer=new ResizeObserver(fit);if(panel.current)observer.observe(panel.current);
    return()=>{observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);};
  },[expanded]);
  function startDrag(event:React.PointerEvent<HTMLElement>){
    if(event.button!==0||!panel.current)return;event.preventDefault();
    const bounds=panel.current.getBoundingClientRect();
    drag.current={pointer:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:{x:bounds.left,y:bounds.top}};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event:React.PointerEvent<HTMLElement>){const current=drag.current;if(!current||current.pointer!==event.pointerId)return;setPosition(clamp({x:current.origin.x+event.clientX-current.start.x,y:current.origin.y+event.clientY-current.start.y}));}
  function endDrag(event:React.PointerEvent<HTMLElement>){if(drag.current?.pointer===event.pointerId)drag.current=null;}
  function moveWithKeys(event:React.KeyboardEvent<HTMLElement>){const delta:Record<string,Point>={ArrowLeft:{x:-20,y:0},ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20}};if(!delta[event.key])return;event.preventDefault();setPosition(current=>clamp({x:(current?.x??8)+delta[event.key].x,y:(current?.y??8)+delta[event.key].y}));}
  function insert(symbol:MathSymbol){
    const next=[symbol.label,...recent.filter(label=>label!==symbol.label)].slice(0,6);setRecent(next);
    try{localStorage.setItem('mathfolio.recent-symbols',JSON.stringify(next));}catch{}
    onInsert(symbol);
  }
  const keys=(items:MathSymbol[])=><div className="math-keys">{items.map(symbol=><button type="button" key={symbol.label} disabled={disabled} title={symbol.name} aria-label={`Insert ${symbol.label}${notes?' in notes':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>insert(symbol)}>{symbol.label}</button>)}</div>;
  const matches=allSymbols.filter(symbol=>`${symbol.label} ${symbol.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="math-keyboard">
    {keys(commonSymbols.slice(0,16))}
    <button ref={trigger} type="button" className="more-symbols" disabled={disabled} aria-expanded={expanded} aria-controls={id} onMouseDown={event=>event.preventDefault()} onClick={()=>setExpanded(value=>!value)}>{expanded?'Fewer symbols ▴':'More symbols ▾'}</button>
    <div ref={panel} id={id} hidden={!expanded} style={position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined} className="symbol-browser" role="region" aria-label="Math symbols">
      <div className="symbol-drawer-heading"><div className="symbol-drag-handle" role="button" tabIndex={0} aria-label="Move math keyboard" title="Drag to move · arrow keys also move this panel" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={moveWithKeys}><span aria-hidden="true">⠿</span><strong>Math symbols{notes?' · Notes':''}</strong></div><button type="button" aria-label="Close symbol keyboard" onClick={()=>{setExpanded(false);trigger.current?.focus();}}>✕</button></div>
      <input aria-label="Search math symbols" placeholder="Search symbols, e.g. subset or integral" maxLength={60} value={search} onChange={event=>setSearch(event.target.value)}/>
      {!search&&recent.length>0&&<div className="recent-symbols"><small>Recently used</small>{keys(recent.flatMap(label=>allSymbols.find(symbol=>symbol.label===label)??[]))}</div>}
      <div className="symbol-categories" role="group" aria-label="Symbol categories">{symbolCategories.map((item,index)=><button type="button" key={item.name} disabled={disabled} aria-pressed={category===index} onClick={()=>setCategory(index)}>{item.name}</button>)}</div>
      <div className="symbol-category-content" role="group" aria-label={search?'Search results':symbolCategories[category].name}>{keys(search?matches:symbolCategories[category].symbols)}{search&&!matches.length&&<p className="subtle">No matching symbols.</p>}</div>
    </div>
  </div>;
}
