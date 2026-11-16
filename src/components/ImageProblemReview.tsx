import { useEffect, useRef, useState } from 'react';
import { readProblemImage, type ProblemImage } from '../image-import';
import { mixedTextToLatex } from '../math-paste';
import { normalizeProblemText } from '../problem-text';
import { MathInput } from './MathInput';
import { PdfFormulaCropper } from './PdfFormulaCropper';
export function ImageProblemReview({image,onClose,onApply,suspended,error,canKeepImage}:{image:ProblemImage;onClose:()=>void;onApply:(text:string,keep:boolean)=>Promise<void>;suspended:boolean;error:string;canKeepImage:boolean}) {
  const [formulaBusy,setFormulaBusy]=useState(false);const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [applying,setApplying]=useState(false);const [stage,setStage]=useState('');const [failure,setFailure]=useState('');const [keep,setKeep]=useState(canKeepImage);
  const active=useRef<AbortController|null>(null);const dialog=useRef<HTMLElement>(null);const close=useRef<HTMLButtonElement>(null);
  const callbacks=useRef({onClose,suspended});callbacks.current={onClose,suspended};
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(callbacks.current.suspended)return;
      if(event.key==='Escape'){event.preventDefault();callbacks.current.onClose();}
      if(event.key!=='Tab')return;
      const nodes=[...dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),summary,math-field')??[]].filter(node=>!node.closest('[hidden]'));
      const first=nodes[0],last=nodes.at(-1);if(!first||!last)return;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);
    return()=>{active.current?.abort();active.current=null;document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
  },[]);
  function stop(){const job=active.current;active.current=null;job?.abort();setBusy(false);setStage('');setFailure('');}
  async function read(textOnly=false){
    if(active.current)return;
    const job=new AbortController();active.current=job;setBusy(true);setFailure('');
    try{
      const result=await readProblemImage(image,value=>{if(active.current===job)setStage(value);},job.signal,textOnly);
      if(active.current!==job)return;
      setText(normalizeProblemText(result.text));setStage(result.source==='on_device'?'Read with local AI. Check the transcription.':'Read with browser OCR. Check every formula.');
    }catch(reason){if(active.current===job)setFailure(reason instanceof Error?reason.message:'Could not read this image.');}
    finally{if(active.current===job){active.current=null;setBusy(false);}}
  }
  return <div className="modal-backdrop image-backdrop" inert={suspended}><section ref={dialog} className="paper import-review-dialog" role="dialog" aria-modal="true" aria-labelledby="image-review-title">
    <header className="import-review-header"><div><p className="eyebrow">1 · SOURCE　2 · REVIEW　3 · USE</p><h2 id="image-review-title">Read a problem from an image</h2><p className="subtle">Your image stays on this device. Printed problems work best.</p></div><button ref={close} aria-label="Close image import" disabled={applying} onClick={onClose}>✕</button></header>
    <div className="import-review-columns"><div className="import-source"><img className="source-image" src={image.data} alt={image.name}/><details><summary>Correct a formula from the image</summary><PdfFormulaCropper image={image.data} imageLabel="Problem image for formula selection" disabled={busy||formulaBusy||applying} onBusyChange={setFormulaBusy} onInsert={latex=>setText(value=>`${value}\n\\(${latex}\\)`)}/></details></div>
      <div className="import-edit"><div className="row"><button className="primary" disabled={busy||formulaBusy||applying} onClick={()=>void read()}>Read image on this device</button><button disabled={busy||formulaBusy||applying} onClick={()=>void read(true)}>Read printed text</button>{busy&&<button className="stop-ai" onClick={stop}>Stop reading</button>}</div>
        {stage&&<p className="subtle" role="status">{stage}</p>}{busy&&<div className="recognition-skeleton" aria-label="Recognizing image"/>}
        <h3>Review your problem</h3>{text?<MathInput label="Recognized image problem" value={mixedTextToLatex(text)} readOnly/>:<p className="empty-import">Read the image, or enter its text below. Nothing is added until you choose Use this problem.</p>}
        <label>Recognized text — edit before using<textarea aria-label="Recognized image text" value={text} maxLength={6000} disabled={busy||formulaBusy||applying} onChange={event=>setText(event.target.value)}/></label>
        <button disabled={busy||formulaBusy||applying} onClick={()=>setText(normalizeProblemText(text))}>Format text</button>
        <label className="check"><input type="checkbox" checked={keep} disabled={!canKeepImage||busy||applying} onChange={event=>setKeep(event.target.checked)}/>Keep the image with this exercise</label>{!canKeepImage&&<p className="subtle">This exercise already has 4 images. You can still use the recognized text.</p>}
        {(failure||error)&&<p className="notice error" role="alert">{failure||error}</p>}
      </div></div>
    <footer className="import-review-footer"><span className="subtle">Compare with the source. Correct unreadable symbols before continuing.</span><div className="row"><button disabled={applying} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||formulaBusy||applying||!text.trim()} onClick={async()=>{setApplying(true);try{await onApply(text,keep);}finally{setApplying(false);}}}>Use this problem</button></div></footer>
  </section></div>;
}
