import {useEffect,useRef,useState} from 'react';
import type {DrawingEquation} from '../drawing';
import type {PreparedEquation} from '../drawing-equations';
import {MathInput,type MathInputHandle} from './MathInput';
interface Props {rows:DrawingEquation[];prepared:Map<string,PreparedEquation>;selected:string[];disabled:boolean;onUpdate:(row:DrawingEquation)=>void;onDelete:(id:string)=>void;onSelect:(id:string)=>void}
const colors=['#3578b1','#b75478','#56875b','#a07824'];
const symbolKeys=[
  ['x','x','x'],['y','y','y'],['=','=','Equals'],['+','+','Plus'],['−','-','Minus'],['×','\\cdot','Multiply'],
  ['a/b','\\frac{#?}{#?}','Fraction'],['xⁿ','^{#?}','Power'],['√','\\sqrt{#?}','Square root'],['|x|','\\left|#?\\right|','Absolute value'],['( )','\\left(#?\\right)','Parentheses'],['[ ]','\\left[#?\\right]','List'],
  ['<','<','Less than'],['≤','\\le','Less than or equal'],['>','>','Greater than'],['≥','\\ge','Greater than or equal'],['π','\\pi','Pi'],['e','e','Euler constant'],
  ['sin','\\sin(#?)','Sine'],['cos','\\cos(#?)','Cosine'],['tan','\\tan(#?)','Tangent'],['ln','\\ln(#?)','Natural logarithm'],['log','\\log(#?)','Logarithm'],['exp','\\exp(#?)','Exponential'],
  [',',',','List separator'],['…','\\ldots','Range'],['ⁿ√','\\sqrt[#?]{#?}','Nth root'],['asin','\\arcsin(#?)','Inverse sine'],['acos','\\arccos(#?)','Inverse cosine'],['atan','\\arctan(#?)','Inverse tangent']
];
function blank(id:string,index:number):DrawingEquation{return {id,type:'equation',latex:'',style:{color:colors[index%colors.length],width:2,dashed:false}};}
export function DrawingEquations({rows,prepared,selected,disabled,onUpdate,onDelete,onSelect}:Props){
  const emptyId=useRef(crypto.randomUUID()),inputs=useRef(new Map<string,MathInputHandle>()),[active,setActive]=useState<string|null>(null),[focus,setFocus]=useState<string|null>(null),[keyboard,setKeyboard]=useState(true);
  const shown=rows.length?rows:[blank(emptyId.current,0)],activeId=shown.some(row=>row.id===active)?active!:shown[0].id;
  useEffect(()=>{if(focus){inputs.current.get(focus)?.focus();setFocus(null);}},[focus,rows]);
  function add(){if(rows.length>=16)return;const row=blank(crypto.randomUUID(),rows.length);onUpdate(row);setActive(row.id);setFocus(row.id);}
  function addParameter(name:string){if(rows.length>=16)return;onUpdate({...blank(crypto.randomUUID(),rows.length),latex:`${name}=1`});}
  return <section className="drawing-equation-tools" aria-label="Equations and expressions"><div className="equation-list-heading"><h3>Expressions</h3><button type="button" disabled={disabled||rows.length>=16} onClick={add}>＋ Add line</button></div>
    <div className="equation-rows">{shown.map((row,index)=>{const result=prepared.get(row.id),value=result?.value;return <div className="equation-row" data-active={activeId===row.id} data-selected={selected.includes(row.id)} key={row.id}>
      <div className="equation-row-heading"><button className="equation-visibility" type="button" aria-label={`${row.visible===false?'Show':'Hide'} expression ${index+1}`} aria-pressed={row.visible!==false} title="Show or hide this graph" disabled={disabled} style={{color:row.style.color}} onClick={()=>onUpdate({...row,visible:row.visible===false})}>●</button><span>{index+1}</span><button type="button" className="equation-remove" aria-label={`Remove expression ${index+1}`} disabled={disabled} onClick={()=>onDelete(row.id)}>✕</button></div>
      <div onFocusCapture={()=>{setActive(row.id);onSelect(row.id);}} onPointerDownCapture={()=>setActive(row.id)}><MathInput ref={value=>{if(value)inputs.current.set(row.id,value);else inputs.current.delete(row.id);}} label={`Equation ${index+1}`} value={row.latex} onChange={latex=>onUpdate({...row,latex})} mathOnly compact maxLength={600} disabled={disabled} placeholder="Enter an equation or expression"/></div>
      {result?.kind==='parameter'&&typeof value==='number'&&<ParameterSlider row={row} parameter={result.parameter!} value={value} disabled={disabled} onUpdate={onUpdate}/>}
      {result?.error&&<div className="equation-error"><small role="alert">{result.error}</small>{result.missing?.map(name=><button type="button" disabled={disabled||rows.length>=16} key={name} onClick={()=>addParameter(name)}>Add slider for {name}</button>)}</div>}
      {row.offset&&(row.offset.x||row.offset.y)?<small>Translation: ({Number(row.offset.x.toFixed(4))}, {Number(row.offset.y.toFixed(4))})</small>:null}
    </div>;})}</div>
    <button type="button" className="equation-keyboard-toggle" aria-expanded={keyboard} disabled={disabled} onClick={()=>setKeyboard(value=>!value)}>{keyboard?'Hide equation keyboard':'Equation keyboard'}</button>
    {keyboard&&<div className="equation-keyboard" role="group" aria-label="Equation math keyboard">{symbolKeys.map(([label,latex,name])=><button type="button" key={name} aria-label={`Equation key: ${name}`} title={name} disabled={disabled} onPointerDown={event=>event.preventDefault()} onMouseDown={event=>event.preventDefault()} onClick={()=>{const input=inputs.current.get(activeId);input?.focus();input?.insert(latex);}}>{label}</button>)}</div>}
    <p className="equation-help">Try x − y = 2, x² + y² = 9, or b = 1 on its own line. Ranges such as [−5, …, 5] draw a family of curves. Angles use radians.</p>
  </section>;
}
function ParameterSlider({row,parameter,value,disabled,onUpdate}:{row:DrawingEquation;parameter:string;value:number;disabled:boolean;onUpdate:(row:DrawingEquation)=>void}){
  const min=Math.min(row.slider?.min??-5,value),max=Math.max(row.slider?.max??5,value),step=row.slider?.step??.01;
  const [low,setLow]=useState(String(min)),[high,setHigh]=useState(String(max));
  useEffect(()=>{setLow(String(min));setHigh(String(max));},[min,max]);
  function bounds(){const a=Number(low),b=Number(high);if(Number.isFinite(a)&&Number.isFinite(b)&&a<b&&a>=-1e6&&b<=1e6)onUpdate({...row,slider:{min:a,max:b,step}});else{setLow(String(min));setHigh(String(max));}}
  return <div className="equation-slider"><input aria-label={`Minimum for ${parameter}`} type="text" inputMode="decimal" value={low} disabled={disabled} onChange={event=>setLow(event.target.value)} onBlur={bounds}/><input aria-label={`Slider ${parameter}`} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event=>onUpdate({...row,latex:`${parameter}=${Number(Number(event.target.value).toFixed(5))}`})}/><input aria-label={`Maximum for ${parameter}`} type="text" inputMode="decimal" value={high} disabled={disabled} onChange={event=>setHigh(event.target.value)} onBlur={bounds}/></div>;
}
