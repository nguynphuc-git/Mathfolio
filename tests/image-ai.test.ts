import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({model:vi.fn(),initialize:vi.fn(),generate:vi.fn()}));
vi.mock('../src/firebase',()=>({getCloudFirebaseApp:()=>({})}));
vi.mock('firebase/ai',async(importOriginal)=>({...await importOriginal<typeof import('firebase/ai')>(),getAI:()=>({}),getGenerativeModel:mock.model}));
import {transcribeProblemImage} from '../src/ai';
import {InferenceMode} from 'firebase/ai';
const image='data:image/jpeg;base64,AA==';
beforeEach(()=>{mock.model.mockReset();mock.initialize.mockReset().mockResolvedValue(undefined);mock.generate.mockReset();mock.model.mockReturnValue({initializeDeviceModel:mock.initialize,generateContent:mock.generate});});
describe('image transcription boundary',()=>{
  it('requires ONLY_ON_DEVICE and sends typed image parts with the abort signal',async()=>{
    mock.generate.mockResolvedValue({response:{text:()=>String.raw`Solve \(x^2=4\)`,inferenceSource:'ON_DEVICE'}});
    const controller=new AbortController();
    await expect(transcribeProblemImage(image,controller.signal)).resolves.toContain('x^2=4');
    expect(mock.model.mock.calls[0][1]).toMatchObject({mode:InferenceMode.ONLY_ON_DEVICE,onDeviceParams:{createOptions:{signal:controller.signal},promptOptions:{signal:controller.signal}}});
    expect(mock.generate.mock.calls[0][0][1]).toEqual({type:'inlineData',inlineData:{mimeType:'image/jpeg',data:'AA=='}});
    expect(mock.generate.mock.calls[0][0][0].text).toContain('Do not solve');
  });
  it('rejects echo-only and non-device responses',async()=>{
    mock.generate.mockResolvedValueOnce({response:{text:()=> 'On-device model is not available in Chromium, this API is just echoing back the input: prompt'}})
      .mockResolvedValueOnce({response:{text:()=> 'x=1',inferenceSource:'IN_CLOUD'}});
    await expect(transcribeProblemImage(image)).rejects.toThrow('cannot read images');
    await expect(transcribeProblemImage(image)).rejects.toThrow('did not run on-device');
  });
  it('makes no model call for invalid data or an already stopped operation',async()=>{
    await expect(transcribeProblemImage('https://example.test/p.png')).rejects.toThrow('supported image');
    const controller=new AbortController();controller.abort();
    await expect(transcribeProblemImage(image,controller.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(mock.model).not.toHaveBeenCalled();
  });
});
