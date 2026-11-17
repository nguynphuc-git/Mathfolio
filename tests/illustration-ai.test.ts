import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({model:vi.fn(),initialize:vi.fn(),stream:vi.fn(),generate:vi.fn()}));
vi.mock('../src/firebase',()=>({getCloudFirebaseApp:()=>({})}));
vi.mock('firebase/ai',async original=>({...await original<typeof import('firebase/ai')>(),getAI:()=>({}),getGenerativeModel:mock.model}));
import {InferenceMode} from 'firebase/ai';
import {notebookAI,notebookPrompt,generateProofDiagram,type NotebookRequest} from '../src/ai';
import {exampleProofScene} from '../src/geometry-proof-examples';
import {geometryExamples} from '../src/geometry';
const image={name:'triangle.png',data:'data:image/png;base64,AA=='};
const base:NotebookRequest={purpose:'knowledge',statement:'2x+3=7',knowledge:'',hints:[],messages:[],question:'',route:'local',cloudAllowed:false,images:[image]};
function response(source='ON_DEVICE',text='Use the marked lengths in the attached diagram.'){
  const value={text:()=>text,inferenceSource:source,candidates:[]};return {stream:(async function*(){yield value;})(),response:Promise.resolve(value)};
}
afterEach(()=>vi.unstubAllGlobals());
beforeEach(()=>{vi.stubGlobal('navigator',{onLine:true});mock.model.mockReset();mock.initialize.mockReset().mockResolvedValue(undefined);mock.stream.mockReset().mockResolvedValue(response());mock.generate.mockReset().mockResolvedValue({response:{text:()=> 'Cloud result',inferenceSource:'IN_CLOUD',candidates:[]}});mock.model.mockReturnValue({initializeDeviceModel:mock.initialize,generateContentStream:mock.stream,generateContent:mock.generate});});
describe('illustrations are actual model input',()=>{
  const worksheet='Exercise 1. Prove a_n=n/(n+3) is Cauchy.\nExercise 2. Prove every Cauchy sequence is bounded.\nExercise 3. Prove a Cauchy sequence with a convergent subsequence converges.';
  it.each(['hint1','hint2'] as const)('generates %s separately for all three exercises and combines the complete result',async purpose=>{
    const answers=['Bound arbitrary pairs.','Choose a fixed tail index.','Combine the Cauchy and subsequence bounds.'];
    mock.stream.mockImplementation(async()=>response('ON_DEVICE',answers[mock.stream.mock.calls.length-1]));
    const onText=vi.fn(),result=await notebookAI({...base,purpose,statement:worksheet,hints:['### Exercise 1\nOnly the first hint.\n\n### Exercise 2\nOnly the second hint.'],images:[]},onText,new AbortController().signal);
    expect(mock.stream).toHaveBeenCalledTimes(3);
    const prompts=mock.stream.mock.calls.map(call=>JSON.parse(call[0].split('\n').at(-1)));
    expect(prompts.map(prompt=>prompt.problem)).toEqual(worksheet.split('\n'));
    expect(mock.stream.mock.calls[1][0]).toContain('ONLY for Exercise 2');
    if(purpose==='hint2'){expect(prompts[1].earlierHints).toEqual(['Only the second hint.']);expect(prompts[2].earlierHints).toEqual([]);}
    for(let i=0;i<3;i++){expect(result.text).toContain(`### Exercise ${i+1}\n${answers[i]}`);}
    expect(onText.mock.calls.at(-1)?.[0]).toBe(result.text);
    expect(mock.model.mock.calls.every(call=>call[1].mode===InferenceMode.ONLY_ON_DEVICE)).toBe(true);
  });
  it('stops between exercises without starting remaining work or returning a partial saved hint',async()=>{
    const controller=new AbortController();mock.stream.mockResolvedValue(response('ON_DEVICE','First hint.'));
    const onText=vi.fn(()=>controller.abort());
    await expect(notebookAI({...base,purpose:'hint1',statement:worksheet,images:[]},onText,controller.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(mock.stream).toHaveBeenCalledOnce();
  });
  it('requires coverage of all visual tasks and checks a valid Cauchy proof instead of consecutive gaps',()=>{
    const prompt=notebookPrompt({...base,purpose:'hint1'});
    expect(prompt).toContain('text AND images');expect(prompt).toContain('m,n >= N');expect(prompt).toContain('consecutive differences tending to zero alone are insufficient');
    expect(prompt).not.toContain('maximum 40 words');expect(prompt).toContain('Do not reveal the answer');
  });
  it('bypasses text-only formula shortcuts and sends typed image parts to ONLY_ON_DEVICE',async()=>{
    const controller=new AbortController();await notebookAI(base,()=>{},controller.signal);
    expect(mock.model.mock.calls.at(-1)?.[1]).toMatchObject({mode:InferenceMode.ONLY_ON_DEVICE,onDeviceParams:{createOptions:{signal:controller.signal}}});
    expect(mock.stream.mock.calls[0][0][1]).toEqual({type:'inlineData',inlineData:{mimeType:'image/png',data:'AA=='}});
    const prompt=mock.stream.mock.calls[0][0][0].text;expect(prompt).toContain('attached illustrations');expect(prompt).not.toContain('base64');
  });
  it.each(['knowledge','hint2','hint3','chat'] as const)('requires cloud permission before sending images for %s',async purpose=>{
    await expect(notebookAI({...base,purpose,route:'cloud',cloudAllowed:false},()=>{})).rejects.toThrow('Allow cloud AI');expect(mock.model).not.toHaveBeenCalled();expect(mock.stream).not.toHaveBeenCalled();
  });
  it('sends images to cloud only on the explicitly authorized second-hint route',async()=>{
    await notebookAI({...base,purpose:'hint2',route:'cloud',cloudAllowed:true},()=>{});
    expect(mock.model.mock.calls.at(-1)?.[1].mode).toBe(InferenceMode.ONLY_IN_CLOUD);expect(mock.initialize).not.toHaveBeenCalled();expect(mock.generate.mock.calls[0][0][1].inlineData.mimeType).toBe('image/png');expect(mock.stream).not.toHaveBeenCalled();
  });
  it('forces the visual first hint onto the device even if a caller requests cloud',async()=>{
    await notebookAI({...base,purpose:'hint1',route:'cloud',cloudAllowed:true},()=>{},new AbortController().signal);
    expect(mock.model.mock.calls.at(-1)?.[1].mode).toBe(InferenceMode.ONLY_ON_DEVICE);expect(mock.initialize).toHaveBeenCalled();expect(mock.stream.mock.calls[0][0][1].inlineData.mimeType).toBe('image/png');
  });
  it('fails explicitly when device vision is unavailable, without retrying in cloud or dropping images',async()=>{
    mock.initialize.mockRejectedValueOnce(new Error('No image support'));
    await expect(notebookAI(base,()=>{})).rejects.toThrow('Local AI could not prepare these illustrations');expect(mock.model).toHaveBeenCalledOnce();expect(mock.stream).not.toHaveBeenCalled();
  });
  it('cancels local preparation and never starts an image prompt after a late initialization',async()=>{
    let finish!:()=>void;mock.initialize.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const controller=new AbortController(),pending=notebookAI(base,()=>{},controller.signal);controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});finish();await Promise.resolve();expect(mock.stream).not.toHaveBeenCalled();
  });
  it('rejects external URLs before touching the model and keeps image bytes out of prompt JSON',async()=>{
    await expect(notebookAI({...base,images:[{name:'bad.png',data:'https://example.com/private.png'}]},()=>{})).rejects.toThrow('PNG, JPG or WebP');expect(mock.model).not.toHaveBeenCalled();
    expect(notebookPrompt({...base,route:'cloud'})).toContain('Never assume lengths');expect(notebookPrompt(base)).not.toContain(image.data);
  });
});

it('solves a supported simple local equation without initializing or calling the model',async()=>{
  const result=await notebookAI({...base,purpose:'hint3',images:[]},()=>{});
  expect(result.source).toBe('local_calculation');expect(result.text).toContain('x=2');
  expect(mock.model).not.toHaveBeenCalled();expect(mock.initialize).not.toHaveBeenCalled();
});

describe('proof diagram AI boundary',()=>{
  const statement='Given a circle with two tangents from P, prove the tangent segments are equal.';
  const signal=()=>new AbortController().signal;
  const valid=()=>({response:{text:()=>JSON.stringify(exampleProofScene(geometryExamples[0].statement)),inferenceSource:'ON_DEVICE',candidates:[]}});
  it('constructs built-in examples immediately without invoking a model',async()=>{
    const result=await generateProofDiagram(geometryExamples[0].statement,'local',false,[],signal());
    expect(result.source).toBe('local_construction');expect(result.showAuxiliary).toBe(false);expect(mock.model).not.toHaveBeenCalled();
  });
  it('sends uploaded illustrations locally and validates the returned scene',async()=>{
    mock.generate.mockResolvedValueOnce(valid());
    const result=await generateProofDiagram(statement,'local',false,[image],signal());
    expect(result.scene.dimension).toBe('2D');expect(result.statement).toBe(statement);
    expect(mock.model.mock.calls.at(-1)?.[1].mode).toBe(InferenceMode.ONLY_ON_DEVICE);
    expect(mock.generate.mock.calls[0][0][1].inlineData.mimeType).toBe('image/png');
  });
  it('requires permission before any cloud call',async()=>{
    await expect(generateProofDiagram(statement,'cloud',false,[image],signal())).rejects.toThrow('Allow Cloud AI');
    expect(mock.model).not.toHaveBeenCalled();
  });
  it('rejects malformed or truncated scenes rather than saving them',async()=>{
    mock.generate.mockResolvedValueOnce({response:{text:()=>'{bad JSON',candidates:[]}});
    await expect(generateProofDiagram(statement,'local',false,[],signal())).rejects.toThrow('did not return a diagram');
    mock.generate.mockResolvedValueOnce({response:{text:()=>JSON.stringify({}),candidates:[{finishReason:'MAX_TOKENS'}]}});
    await expect(generateProofDiagram(statement,'local',false,[],signal())).rejects.toThrow('incomplete');
  });
  it('explains local capacity errors without sending the problem to cloud',async()=>{
    mock.generate.mockRejectedValueOnce(new DOMException('The input is too large.','QuotaExceededError'));
    await expect(generateProofDiagram(statement,'local',false,[],signal())).rejects.toThrow('local model’s input capacity');
    expect(mock.model).toHaveBeenCalledOnce();expect(mock.generate).toHaveBeenCalledOnce();
  });
  it('cancels diagram generation and ignores a late response',async()=>{
    let finish!:(value:ReturnType<typeof valid>)=>void;
    mock.generate.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const controller=new AbortController(),pending=generateProofDiagram(statement,'local',false,[],controller.signal);
    await vi.waitFor(()=>expect(mock.generate).toHaveBeenCalledOnce());controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});finish(valid());
  });
});
