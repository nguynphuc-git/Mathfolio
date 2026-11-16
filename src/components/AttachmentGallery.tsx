import type {Attachment} from '../notebook';
export function AttachmentGallery({images,onOpen,onRemove,disabled=false,showKind=false,onAISelection}:{images:Attachment[];onOpen:(image:Attachment)=>void;onRemove?:(id:string)=>void;disabled?:boolean;showKind?:boolean;onAISelection?:(id:string,included:boolean)=>void}) {
  return <div className="attachments">{images.map(image=><figure key={image.id}>
    <button type="button" className="attachment-thumbnail" aria-label={`View image: ${image.name}`} title="Open image · zoom and pan" onClick={()=>onOpen(image)}><img src={image.data} alt={image.name}/><span aria-hidden="true">⤢</span></button>
    <figcaption>{showKind?`${image.kind==='problem'?'Problem':'Your solution'} · `:''}{image.name}{onRemove&&<button type="button" disabled={disabled} onClick={()=>onRemove(image.id)}>Remove</button>}</figcaption>{onAISelection&&image.kind==='problem'&&<label className="check image-ai-choice"><input type="checkbox" checked={image.useForAI!==false} disabled={disabled} onChange={event=>onAISelection(image.id,event.target.checked)}/>Use this illustration for AI</label>}
  </figure>)}</div>;
}
