import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,expect,it} from 'vitest';
import {loadAppearancePreferences} from '../src/appearance';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bootstrap=html.match(/<script>([\s\S]*?)<\/script>/)![1];

describe('appearance before the app bundle loads',()=>{
  it.each(['light','dark','kitty'])('agrees with the app for saved %s and preserves its paper color',theme=>{
    const saved=JSON.stringify({theme,background:'blue'}),dataset:Record<string,string>={};
    runInNewContext(bootstrap,{localStorage:{getItem:()=>saved},document:{documentElement:{dataset}},matchMedia:()=>({matches:true})});
    expect(dataset.theme).toBe(loadAppearancePreferences({getItem:()=>saved}).theme);
    expect(dataset.paper).toBe('blue');
  });
  it.each([true,false])('resolves legacy System before painting (dark: %s)',dark=>{
    const dataset:Record<string,string>={};
    runInNewContext(bootstrap,{localStorage:{getItem:()=>JSON.stringify({theme:'system'})},document:{documentElement:{dataset}},matchMedia:()=>({matches:dark})});
    expect(dataset.theme).toBe(dark?'dark':'light');
  });
  it.each(['{broken','null','[]','42',JSON.stringify({theme:'unexpected',background:'url(x)'})])('tolerates damaged preferences %s',saved=>{
    const dataset:Record<string,string>={};
    expect(()=>runInNewContext(bootstrap,{localStorage:{getItem:()=>saved},document:{documentElement:{dataset}}})).not.toThrow();
    expect([undefined,'light']).toContain(dataset.theme);
    expect(html).toContain('html[data-theme=kitty] body{background:#f8e8ee');
    expect(html).toContain('html[data-theme=dark] body{background:#171d1a');
  });
});
