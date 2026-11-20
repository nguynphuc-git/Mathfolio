/** Export a clean, light-background PNG; selection handles and hit targets are omitted. The visible viewport is the exported frame. */
export async function exportDrawing(svg:SVGSVGElement,signal:AbortSignal):Promise<string>{
  signal.throwIfAborted();const [x,y,widthValue,heightValue]=(svg.getAttribute('viewBox')??'0 0 1000 640').trim().split(/[ ,]+/).map(Number);const area={x,y,width:widthValue,height:heightValue};
  if(![x,y,widthValue,heightValue].every(Number.isFinite)||area.width<24||area.height<24)throw new Error('The drawing frame is not ready.');
  const clone=svg.cloneNode(true) as SVGSVGElement;clone.querySelectorAll('[data-ui]').forEach(node=>node.remove());
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('viewBox',`${area.x} ${area.y} ${area.width} ${area.height}`);
  const scale=Math.min(2,1800/Math.max(area.width,area.height)),width=Math.round(area.width*scale),height=Math.round(area.height*scale);
  clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));clone.setAttribute('style','--drawing-bg:#ffffff;--drawing-ink:#243d31;--drawing-grid:#e3e9e2;--drawing-axis:#6d8173;background:#ffffff;');
  const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
  try{
    const image=new Image();await new Promise<void>((resolve,reject)=>{const abort=()=>{image.src='';reject(new DOMException('Cancelled','AbortError'));};signal.addEventListener('abort',abort,{once:true});const done=()=>signal.removeEventListener('abort',abort);image.onload=()=>{done();resolve();};image.onerror=()=>{done();reject(new Error('Could not render this drawing.'));};image.src=url;});
    signal.throwIfAborted();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('Image export is unavailable in this browser.');
    context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);const data=canvas.toDataURL('image/png');canvas.width=0;canvas.height=0;
    if(!data.startsWith('data:image/png;base64,')||data.length>4*1024*1024)throw new Error('This drawing is too large. Simplify it before adding the image.');return data;
  }finally{URL.revokeObjectURL(url);}
}
