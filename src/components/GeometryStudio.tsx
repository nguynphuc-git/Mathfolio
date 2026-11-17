import {geometryExamples} from '../geometry';
export function GeometryStudio({disabled,onUse,onClose}:{disabled:boolean;onUse:(title:string,statement:string)=>void;onClose:()=>void}) {
  return <section className="paper geometry-studio" aria-labelledby="geometry-title">
    <header className="studio-heading"><div><p className="eyebrow">GIVENS → CONSTRUCTION → PROOF</p><h2 id="geometry-title">Geometry proofs</h2><p>Upload a PDF or image using the workspace toolbar, or paste your problem and LaTeX into Problem. Review the text, then choose Create diagram.</p></div><button onClick={onClose} aria-label="Close geometry studio">Close</button></header>
    <p className="subtle">Circles, cyclic quadrilaterals and spatial geometry. The drawing uses the hypotheses; auxiliary constructions appear in violet. Open hints gradually, just like an algebra problem.</p>
    <div className="geometry-example-grid">{geometryExamples.map(example=><article key={example.id}><span className="tag">{example.dimension} · PROOF</span><h3>{example.title}</h3><p>{example.description}</p><button disabled={disabled} onClick={()=>onUse(example.title,example.statement)}>Try this proof</button></article>)}</div>
  </section>;
}
