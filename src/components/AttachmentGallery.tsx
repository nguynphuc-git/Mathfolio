import type {Attachment} from '../notebook';
export function AttachmentGallery({images,onOpen,onRemove,disabled=false,showKind=false}:{images:Attachment[];onOpen:(image:Attachment)=>void;onRemove?:(id:string)=>void;disabled?:boolean;showKind?:boolean}) {
  return <div className="attachments">{images.map(image=><figure key={image.id}>
    <button type="button" className="attachment-thumbnail" aria-label={`View image: ${image.name}`} title="Open image · zoom and pan" onClick={()=>onOpen(image)}><img src={image.data} alt={image.name}/><span aria-hidden="true">⤢</span></button>
    <figcaption>{showKind?`${image.kind==='problem'?'Problem':'Your solution'} · `:''}{image.name}{onRemove&&<button type="button" disabled={disabled} onClick={()=>onRemove(image.id)}>Remove</button>}</figcaption>
  </figure>)}</div>;
}
