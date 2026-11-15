// @vitest-environment happy-dom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('mathlive', async original => {
  const converters = await original<typeof import('mathlive')>();
  class Field extends HTMLElement {
    value=''; mode='math'; readOnly=false; selectionIsCollapsed=true; selected=''; selection={ranges:[[0,0]]};
    insert=vi.fn((latex:string)=>{this.value+=latex;return true;});
    executeCommand=vi.fn(()=>true);
    getValue(){return this.selected;}
    constructor(){ super(); this.attachShadow({mode:'open'}); }
  }
  customElements.define('test-math-editor',Field);
  return {...converters,MathfieldElement:Field};
});
import { MathInput, type MathInputHandle } from '../src/components/MathInput';

interface StubField extends HTMLElement {
  value:string; readOnly:boolean; smartMode:boolean; smartFence:boolean; smartSuperscript:boolean;
  insert:ReturnType<typeof vi.fn>; executeCommand:ReturnType<typeof vi.fn>;
}
let root:Root,host:HTMLDivElement; const change=vi.fn(); const handle=createRef<MathInputHandle>();
function field(){return host.querySelector<StubField>('test-math-editor')!;}
async function paste(mime:string,value:string){
  const data=new DataTransfer();data.setData(mime,value);
  const event=new ClipboardEvent('paste',{clipboardData:data,cancelable:true});
  await act(async()=>field().dispatchEvent(event));return event;
}
beforeEach(async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true}); change.mockReset();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<MathInput ref={handle} value="" onChange={change}/>));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('math editor event integration',()=>{
  it('recognizes prose and math when pasting plain text',async()=>{
    const event=await paste('text/plain','Find x^2 = 4 now');
    expect(event.defaultPrevented).toBe(true);
    expect(field().insert).toHaveBeenCalledWith(expect.stringContaining(String.raw`\text{Find }`),expect.objectContaining({format:'latex',mode:'math'}));
    expect(change).toHaveBeenCalledWith(field().value);
  });
  it('preserves explicit LaTeX and structured MathLive clipboard data',async()=>{
    await paste('application/x-latex',String.raw`\frac{a+b}{c}`);
    expect(field().insert.mock.calls[0][0]).toBe(String.raw`\frac{a+b}{c}`);
    field().insert.mockClear();
    const event=await paste('application/json+mathlive','[{"type":"genfrac"}]');
    expect(event.defaultPrevented).toBe(false);expect(field().insert).not.toHaveBeenCalled();
  });
  it('uses native fence-aware superscripts for keyboard and toolbar actions',async()=>{
    expect(field().smartMode).toBe(true);expect(field().smartFence).toBe(true);expect(field().smartSuperscript).toBe(false);
    const event=new KeyboardEvent('keydown',{key:'^',cancelable:true});
    await act(async()=>field().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);expect(field().executeCommand).toHaveBeenCalledWith('moveToSuperscript');
    field().executeCommand.mockClear();
    await act(async()=>handle.current!.insert('^{2}'));
    expect(field().executeCommand.mock.calls).toEqual([['moveToSuperscript'],['moveAfterParent']]);
    expect(field().insert).toHaveBeenCalledWith('2',expect.anything());
  });
  it('never changes readonly problems or intercepts IME composition',async()=>{
    await act(async()=>root.render(<MathInput ref={handle} value="x" readOnly onChange={change}/>));
    await paste('text/plain','replacement');await act(async()=>handle.current!.insert('^{2}'));
    expect(change).not.toHaveBeenCalled();expect(field().value).toBe('x');
    await act(async()=>root.render(<MathInput ref={handle} value="x" onChange={change}/>));
    const event=new KeyboardEvent('keydown',{key:'^',isComposing:true,cancelable:true});
    await act(async()=>field().dispatchEvent(event));expect(event.defaultPrevented).toBe(false);
  });
  it('rejects oversized paste without truncating the current expression',async()=>{
    await act(async()=>root.render(<MathInput ref={handle} value="x+1" onChange={change}/>));
    await paste('text/plain','a'.repeat(6001));
    expect(field().value).toBe('x+1');expect(change).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('6,000');
  });
});
