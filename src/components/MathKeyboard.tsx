import { useId, useState } from 'react';
import { commonSymbols, symbolCategories, type MathSymbol } from '../math-symbols';
export function MathKeyboard({ onInsert, disabled, notes=false }: { onInsert:(symbol:MathSymbol)=>void; disabled?:boolean; notes?:boolean }) {
  const [expanded,setExpanded]=useState(false); const [category,setCategory]=useState(1); const id=useId();
  const keys=(items:MathSymbol[])=><div className="math-keys">{items.map(symbol=><button type="button" key={symbol.label} disabled={disabled} title={symbol.name} aria-label={`Insert ${symbol.label}${notes?' in notes':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>onInsert(symbol)}>{symbol.label}</button>)}</div>;
  return <div className="math-keyboard">
    {keys(commonSymbols)}
    <button type="button" className="more-symbols" disabled={disabled} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}>{expanded?'Fewer symbols ▴':'More symbols ▾'}</button>
    <div id={id} hidden={!expanded} className="symbol-browser">
      <div className="symbol-categories" role="group" aria-label="Symbol categories">{symbolCategories.map((item,index)=><button type="button" key={item.name} disabled={disabled} aria-pressed={category===index} onClick={()=>setCategory(index)}>{item.name}</button>)}</div>
      <div className="symbol-category-content" role="group" aria-label={symbolCategories[category].name}>{keys(symbolCategories[category].symbols)}</div>
    </div>
  </div>;
}
