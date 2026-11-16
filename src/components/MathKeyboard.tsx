import { useEffect, useId, useRef, useState } from 'react';
import { commonSymbols, symbolCategories, type MathSymbol } from '../math-symbols';
const allSymbols=symbolCategories.flatMap(category=>category.symbols);
function readRecent():string[]{try{const value:unknown=JSON.parse(localStorage.getItem('mathfolio.recent-symbols')??'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,6):[];}catch{return [];}}
export function MathKeyboard({ onInsert, disabled, notes=false }: { onInsert:(symbol:MathSymbol)=>void; disabled?:boolean; notes?:boolean }) {
  const [expanded,setExpanded]=useState(false); const [category,setCategory]=useState(1); const id=useId();
  const [search,setSearch]=useState(''); const [recent,setRecent]=useState(readRecent);
  const container=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(disabled)setExpanded(false);},[disabled]);
  useEffect(()=>{
    if(!expanded)return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setExpanded(false);trigger.current?.focus();}};
    const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setExpanded(false);};
    window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',outside,true);
    return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',outside,true);};
  },[expanded]);
  function insert(symbol:MathSymbol){
    const next=[symbol.label,...recent.filter(label=>label!==symbol.label)].slice(0,6);setRecent(next);
    try{localStorage.setItem('mathfolio.recent-symbols',JSON.stringify(next));}catch{}
    onInsert(symbol);
  }
  const keys=(items:MathSymbol[])=><div className="math-keys">{items.map(symbol=><button type="button" key={symbol.label} disabled={disabled} title={symbol.name} aria-label={`Insert ${symbol.label}${notes?' in notes':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>insert(symbol)}>{symbol.label}</button>)}</div>;
  const matches=allSymbols.filter(symbol=>`${symbol.label} ${symbol.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div ref={container} className="math-keyboard">
    {keys(commonSymbols.slice(0,16))}
    <button ref={trigger} type="button" className="more-symbols" disabled={disabled} aria-expanded={expanded} aria-controls={id} onMouseDown={event=>event.preventDefault()} onClick={()=>setExpanded(value=>!value)}>{expanded?'Fewer symbols ▴':'More symbols ▾'}</button>
    <div id={id} hidden={!expanded} className="symbol-browser" role="region" aria-label="Math symbols">
      <div className="symbol-drawer-heading"><strong>Math symbols</strong><button type="button" aria-label="Close symbol keyboard" onClick={()=>{setExpanded(false);trigger.current?.focus();}}>✕</button></div>
      <input aria-label="Search math symbols" placeholder="Search symbols, e.g. subset or integral" maxLength={60} value={search} onChange={event=>setSearch(event.target.value)}/>
      {!search&&recent.length>0&&<div className="recent-symbols"><small>Recently used</small>{keys(recent.flatMap(label=>allSymbols.find(symbol=>symbol.label===label)??[]))}</div>}
      <div className="symbol-categories" role="group" aria-label="Symbol categories">{symbolCategories.map((item,index)=><button type="button" key={item.name} disabled={disabled} aria-pressed={category===index} onClick={()=>setCategory(index)}>{item.name}</button>)}</div>
      <div className="symbol-category-content" role="group" aria-label={search?'Search results':symbolCategories[category].name}>{keys(search?matches:symbolCategories[category].symbols)}{search&&!matches.length&&<p className="subtle">No matching symbols.</p>}</div>
    </div>
  </div>;
}
