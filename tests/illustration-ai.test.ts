import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({model:vi.fn(),initialize:vi.fn(),stream:vi.fn()}));
vi.mock('../src/firebase',()=>({getCloudFirebaseApp:()=>({})}));
vi.mock('firebase/ai',async original=>({...await original<typeof import('firebase/ai')>(),getAI:()=>({}),getGenerativeModel:mock.model}));
import {InferenceMode} from 'firebase/ai';
import {notebookAI,notebookPrompt,type NotebookRequest} from '../src/ai';
const image={name:'triangle.png',data:'data:image/png;base64,AA=='};
const base:NotebookRequest={purpose:'knowledge',statement:'2x+3=7',knowledge:'',hints:[],messages:[],question:'',route:'local',cloudAllowed:false,images:[image]};
function response(source='ON_DEVICE',text='Use the marked lengths in the attached diagram.'){
  const value={text:()=>text,inferenceSource:source,candidates:[]};return {stream:(async function*(){yield value;})(),response:Promise.resolve(value)};
}
afterEach(()=>vi.unstubAllGlobals());
beforeEach(()=>{vi.stubGlobal('navigator',{onLine:true});mock.model.mockReset();mock.initialize.mockReset().mockResolvedValue(undefined);mock.stream.mockReset().mockResolvedValue(response());mock.model.mockReturnValue({initializeDeviceModel:mock.initialize,generateContentStream:mock.stream});});
describe('illustrations are actual model input',()=>{
  it('bypasses text-only formula shortcuts and sends typed image parts to ONLY_ON_DEVICE',async()=>{
    const controller=new AbortController();await notebookAI(base,()=>{},controller.signal);
    expect(mock.model.mock.calls.at(-1)?.[1]).toMatchObject({mode:InferenceMode.ONLY_ON_DEVICE,onDeviceParams:{createOptions:{signal:controller.signal}}});
    expect(mock.stream.mock.calls[0][0][1]).toEqual({type:'inlineData',inlineData:{mimeType:'image/png',data:'AA=='}});
    const prompt=mock.stream.mock.calls[0][0][0].text;expect(prompt).toContain('attached illustrations');expect(prompt).not.toContain('base64');
  });
  it.each(['knowledge','hint1','hint2','hint3','chat'] as const)('requires cloud permission before sending images for %s',async purpose=>{
    await expect(notebookAI({...base,purpose,route:'cloud',cloudAllowed:false},()=>{})).rejects.toThrow('Allow cloud AI');expect(mock.model).not.toHaveBeenCalled();expect(mock.stream).not.toHaveBeenCalled();
  });
  it('sends images to cloud only on the explicitly authorized route, including a visual first hint',async()=>{
    mock.stream.mockResolvedValue(response('IN_CLOUD'));
    await notebookAI({...base,purpose:'hint1',route:'cloud',cloudAllowed:true},()=>{});
    expect(mock.model.mock.calls.at(-1)?.[1].mode).toBe(InferenceMode.ONLY_IN_CLOUD);expect(mock.initialize).not.toHaveBeenCalled();expect(mock.stream.mock.calls[0][0][1].inlineData.mimeType).toBe('image/png');
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
