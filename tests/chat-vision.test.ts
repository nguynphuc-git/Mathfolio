import {describe,it,expect} from 'vitest';
import {notebookVision} from '../src/problem-vision';
const image=(name:string)=>({name,data:'data:image/png;base64,AA=='});
describe('bounded chat image context',()=>{
  it('keeps at most four recent history images, alongside the separate problem/current message groups',()=>{
    const messages=Array.from({length:6},(_,i)=>({role:'user' as const,text:`message ${i}`,images:[image(`${i}a`),image(`${i}b`)]}));
    const result=notebookVision({purpose:'chat',route:'cloud',images:Array.from({length:4},(_,i)=>image(`problem ${i}`)),messageImages:Array.from({length:4},(_,i)=>image(`current ${i}`)),messages});
    expect(result.parts).toHaveLength(12);expect(result.references.map((r:any)=>r.name)).toEqual(['problem 0','problem 1','problem 2','problem 3','4a','4b','5a','5b','current 0','current 1','current 2','current 3']);
    expect(()=>notebookVision({purpose:'chat',route:'cloud',messages:[],messageImages:Array.from({length:5},()=>image('bad'))})).toThrow('up to 4');
  });
  it('does not include assistant image payloads or unsent chat images in other tasks',()=>{
    expect(notebookVision({purpose:'knowledge',route:'local',messageImages:[image('pending')],messages:[{role:'user',text:'old',images:[image('old')]}]}).parts).toEqual([]);
    expect(notebookVision({purpose:'chat',route:'cloud',messages:[{role:'assistant',text:'not a user attachment',images:[image('ignored')]}]}).parts).toEqual([]);
  });
});
