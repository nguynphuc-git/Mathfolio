import { useState } from 'react';
import { geometryShapes, geometryExamples, calculateGeometry, type GeometryShapeId } from '../geometry';
import { MarkdownView } from './MarkdownView';

function GeometryDiagram({shape}:{shape:GeometryShapeId}) {
  return <svg className="geometry-diagram" viewBox="0 0 320 230" role="img" aria-label={`${shape} dimension diagram, not to scale`}>
    <g fill="var(--diagram-fill)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      {shape==='circle'&&<><circle cx="155" cy="110" r="77"/><path d="M155 110h77"/><circle cx="155" cy="110" r="3" fill="currentColor"/></>}
      {shape==='rectangle'&&<rect x="60" y="55" width="200" height="120" rx="2"/>}
      {shape==='trapezoid'&&<><path d="M105 55h110l60 120H45Z"/><path d="M105 55v120" fill="none" strokeDasharray="6 5"/><path d="M105 160h15v15" fill="none"/></>}
      {shape==='box'&&<><path d="M55 90h170v105H55Z M55 90l50-50h170v105l-50 50 M225 90l50-50"/><path d="M105 40v105H275 M55 195l50-50" fill="none" strokeDasharray="6 5"/></>}
      {shape==='cylinder'&&<><path d="M85 60v120c0 35 150 35 150 0V60"/><ellipse cx="160" cy="60" rx="75" ry="28"/><path d="M85 180c0-35 150-35 150 0 M160 60v120" fill="none" strokeDasharray="6 5"/><path d="M160 60h75"/></>}
      {shape==='cone'&&<><path d="M70 180 160 35 250 180c-10 40-170 40-180 0Z"/><path d="M70 180c0-35 180-35 180 0 M160 35v145" fill="none" strokeDasharray="6 5"/><path d="M160 180h90"/></>}
      {shape==='sphere'&&<><circle cx="160" cy="115" r="80"/><ellipse cx="160" cy="115" rx="80" ry="26" fill="none" strokeDasharray="6 5"/><path d="M160 115h80"/><circle cx="160" cy="115" r="3" fill="currentColor"/></>}
    </g>
    <g fill="currentColor" fontSize="17" fontFamily="Georgia, serif" textAnchor="middle">
      {shape==='circle'&&<text x="195" y="99">r</text>}
      {shape==='rectangle'&&<><text x="160" y="199">l</text><text x="278" y="120">w</text></>}
      {shape==='trapezoid'&&<><text x="160" y="43">a</text><text x="160" y="200">b</text><text x="124" y="120">h</text></>}
      {shape==='box'&&<><text x="140" y="219">l</text><text x="264" y="184">w</text><text x="37" y="149">h</text></>}
      {(shape==='cylinder'||shape==='cone')&&<><text x="199" y={shape==='cone'?171:51}>r</text><text x="144" y="123">h</text></>}
      {shape==='sphere'&&<text x="200" y="104">r</text>}
    </g>
  </svg>;
}
export function GeometryStudio({disabled,onUse,onClose}:{disabled:boolean;onUse:(title:string,statement:string)=>void;onClose:()=>void}) {
  const [shapeId,setShapeId]=useState<GeometryShapeId>('circle');
  const shape=geometryShapes.find(item=>item.id===shapeId)!;
  const [values,setValues]=useState<Record<string,string>>({r:'5'});
  const [unit,setUnit]=useState('cm');
  let result:ReturnType<typeof calculateGeometry>|undefined, error='';
  try{result=calculateGeometry(shapeId,Object.fromEntries(shape.fields.map(field=>[field.key,Number(values[field.key])])),unit);}catch(reason){error=reason instanceof Error?reason.message:'Enter valid dimensions.';}
  return <section className="paper geometry-studio" aria-labelledby="geometry-title">
    <header className="studio-heading"><div><p className="eyebrow">EXPLORE & UNDERSTAND</p><h2 id="geometry-title">Geometry studio</h2><p className="subtle">Explore 2D shapes and 3D solids. Calculate measurements instantly, or work through a proof with your tutor.</p></div><button onClick={onClose} aria-label="Close geometry studio">Close</button></header>
    <div className="geometry-workbench"><div className="geometry-inputs">
      <label>Shape<select value={shapeId} onChange={e=>{const next=geometryShapes.find(item=>item.id===e.target.value)!;setShapeId(next.id);setValues(Object.fromEntries(next.fields.map(field=>[field.key,String(field.defaultValue)])));}}>{['2D','3D'].map(dimension=><optgroup key={dimension} label={`${dimension} shapes`}>{geometryShapes.filter(item=>item.dimension===dimension).map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</optgroup>)}</select></label>
      <figure><GeometryDiagram shape={shapeId}/><figcaption>Schematic only · not to scale</figcaption></figure><p className="subtle">{shape.description}</p>
      <div className="geometry-dimensions">{shape.fields.map(field=><label key={field.key}>{field.label} ({field.symbol})<input type="number" inputMode="decimal" min="0" step="any" value={values[field.key]??''} onChange={e=>setValues(current=>({...current,[field.key]:e.target.value}))}/></label>)}<label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="cm">cm</option><option value="m">m</option><option value="mm">mm</option></select></label></div>
      <p className="subtle">All dimensions use the selected unit. Changing the unit relabels the measurements.</p>
    </div><div className="geometry-result"><span className="source-label">Local calculation · no AI wait</span><div aria-live="polite">{result?<MarkdownView value={result.markdown}/>:<p className="geometry-validation">{error}</p>}</div><button className="primary" disabled={disabled||!result} onClick={()=>result&&onUse(`${shape.label} measurements`,result.statement)}>Open as exercise</button><p className="subtle">Creates a new workspace problem. You can save it to your library.</p></div></div>
    <details className="geometry-examples"><summary>Try a geometry proof or reasoning problem</summary><p className="subtle">For your own problem, enter the givens and what to prove in the Problem editor. Add a labelled diagram under Illustrations if needed.</p><div className="geometry-example-grid">{geometryExamples.map(example=><article key={example.id}><span className="tag">{example.dimension}</span><h3>{example.title}</h3><p>{example.description}</p><button disabled={disabled} onClick={()=>onUse(example.title,example.statement)}>Try this problem</button></article>)}</div></details>
  </section>;
}
