import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {NotebookRequest} from '../src/ai';
const mock=vi.hoisted(()=>({model:vi.fn(),initialize:vi.fn(),stream:vi.fn(),generate:vi.fn()}));
vi.mock('../src/firebase',()=>({getCloudFirebaseApp:()=>({})}));
vi.mock('firebase/ai',async original=>({...await original<typeof import('firebase/ai')>(),getAI:()=>({}),getGenerativeModel:mock.model}));
import {InferenceMode} from 'firebase/ai';

const request:NotebookRequest={purpose:'knowledge',statement:'Prove the logarithm domain is necessary.',knowledge:'',hints:[],messages:[],question:'Why does the domain matter?',route:'cloud',cloudAllowed:true};
const response=(text:string,finishReason='STOP')=>({text:()=>text,inferenceSource:'IN_CLOUD',candidates:[{finishReason}]});
function gate(){let open!:()=>void;const pending=new Promise<void>(resolve=>{open=resolve;});return {pending,open};}
let now:number;
beforeEach(()=>{
  vi.resetModules();vi.stubGlobal('navigator',{onLine:true});now=0;
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  mock.model.mockReset();mock.initialize.mockReset().mockResolvedValue(undefined);mock.stream.mockReset();mock.generate.mockReset();
  mock.model.mockReturnValue({initializeDeviceModel:mock.initialize,generateContentStream:mock.stream,generateContent:mock.generate});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('incremental cloud tutoring',()=>{
  it.each(['knowledge','hint1','hint2','hint3','chat'] as const)('publishes %s chunks before completion and flushes the final tail',async purpose=>{
    const {notebookAI}=await import('../src/ai'),next=gate(),finish=gate(),final=response('Check the logarithm domain.');
    mock.stream.mockResolvedValue({stream:(async function*(){
      yield response('Check ');await next.pending;yield response('the logarithm ');await finish.pending;yield response('domain.');
    })(),response:finish.pending.then(()=>final)});
    const onText=vi.fn(),controller=new AbortController();let completed=false;
    const pending=notebookAI({...request,purpose},onText,controller.signal).then(value=>{completed=true;return value;});
    await vi.waitFor(()=>expect(onText).toHaveBeenLastCalledWith('Check '));expect(completed).toBe(false);
    expect(mock.stream).toHaveBeenCalledExactlyOnceWith(expect.any(String),{signal:controller.signal});
    expect(mock.model.mock.calls[0][1].mode).toBe(InferenceMode.ONLY_IN_CLOUD);
    expect(mock.initialize).not.toHaveBeenCalled();expect(mock.generate).not.toHaveBeenCalled();
    now=110;next.open();await vi.waitFor(()=>expect(onText).toHaveBeenLastCalledWith('Check the logarithm '));expect(completed).toBe(false);
    // The last token arrives inside the throttle window and must still be published.
    finish.open();await expect(pending).resolves.toEqual({text:final.text(),source:'IN_CLOUD'});
    expect(onText.mock.calls.map(call=>call[0])).toEqual(['Check ','Check the logarithm ',final.text()]);
  });
  it('waits for visible content, ignores empty chunks and uses the authoritative final response',async()=>{
    const {notebookAI}=await import('../src/ai');
    mock.stream.mockResolvedValue({stream:(async function*(){yield response('');yield response('  ');yield response('First');yield response(' part');})(),response:Promise.resolve(response('First part.'))});
    const onText=vi.fn();await expect(notebookAI(request,onText)).resolves.toMatchObject({text:'First part.'});
    expect(onText.mock.calls.map(call=>call[0])).toEqual(['  First','First part.']);
  });
  it('does not duplicate a final chunk already shown',async()=>{
    const {notebookAI}=await import('../src/ai'),final=response('Complete.');
    mock.stream.mockResolvedValue({stream:(async function*(){yield final;})(),response:Promise.resolve(final)});
    const onText=vi.fn();await notebookAI(request,onText);expect(onText).toHaveBeenCalledExactlyOnceWith('Complete.');
  });
  it('streams separate worksheet hints with completed sections retained',async()=>{
    const {notebookAI}=await import('../src/ai');
    mock.stream.mockImplementation(async()=>{
      const text=`Hint ${mock.stream.mock.calls.length}.`;
      return {stream:(async function*(){yield response(text);})(),response:Promise.resolve(response(text))};
    });
    const onText=vi.fn(),result=await notebookAI({...request,purpose:'hint1',statement:'Exercise 1. Prove the first claim.\nExercise 2. Prove the second claim.'},onText);
    expect(mock.stream).toHaveBeenCalledTimes(2);expect(result.text).toBe('### Exercise 1\nHint 1.\n\n### Exercise 2\nHint 2.');
    expect(onText).toHaveBeenCalledWith('### Exercise 1\nHint 1.');expect(onText).toHaveBeenLastCalledWith(result.text);
  });
  it('retains consent and offline gates before any request',async()=>{
    const {notebookAI}=await import('../src/ai');
    await expect(notebookAI({...request,cloudAllowed:false},vi.fn())).rejects.toThrow('Allow cloud AI');
    vi.stubGlobal('navigator',{onLine:false});await expect(notebookAI(request,vi.fn())).rejects.toThrow('offline');
    expect(mock.model).not.toHaveBeenCalled();expect(mock.stream).not.toHaveBeenCalled();
  });
  it('stops promptly while waiting for a chunk and ignores late output',async()=>{
    const {notebookAI}=await import('../src/ai'),next=gate(),final=gate(),returned=vi.fn();
    mock.stream.mockResolvedValue({stream:(async function*(){try{yield response('Partial');await next.pending;yield response(' late');}finally{returned();}})(),response:final.pending.then(()=>response('Partial late'))});
    const controller=new AbortController(),onText=vi.fn(),pending=notebookAI(request,onText,controller.signal);
    await vi.waitFor(()=>expect(onText).toHaveBeenCalledWith('Partial'));controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    now=200;next.open();final.open();await vi.waitFor(()=>expect(returned).toHaveBeenCalledOnce());
    expect(onText).toHaveBeenCalledExactlyOnceWith('Partial');
  });
  it('handles a provider that finishes opening its stream after Stop',async()=>{
    const {notebookAI}=await import('../src/ai'),start=gate(),final=gate(),consume=vi.fn();
    mock.stream.mockImplementation(()=>start.pending.then(()=>({stream:(async function*(){consume();yield response('Late');})(),response:final.pending.then(()=>{throw new Error('Late transport failure');})})));
    const controller=new AbortController(),onText=vi.fn(),pending=notebookAI(request,onText,controller.signal);
    await vi.waitFor(()=>expect(mock.stream).toHaveBeenCalledOnce());controller.abort();await expect(pending).rejects.toMatchObject({name:'AbortError'});
    start.open();final.open();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(consume).not.toHaveBeenCalled();expect(onText).not.toHaveBeenCalled();
  });
  it.each(['MAX_TOKENS','empty','transport'])('rejects an invalid %s result rather than accepting a partial answer',async failure=>{
    const {notebookAI}=await import('../src/ai');
    mock.stream.mockResolvedValue({stream:(async function*(){yield response('Partial');if(failure==='transport')throw new Error('Stream connection lost');})(),response:Promise.resolve(response(failure==='empty'?'':'Partial',failure==='MAX_TOKENS'?'MAX_TOKENS':'STOP'))});
    const onText=vi.fn();await expect(notebookAI(request,onText)).rejects.toThrow(failure==='MAX_TOKENS'?'cut off':failure==='empty'?'No answer':'connection lost');
    expect(onText).toHaveBeenCalledExactlyOnceWith('Partial');expect(mock.generate).not.toHaveBeenCalled();
  });
});
