import {describe,it,expect} from 'vitest';
import {drawingLatexExpression} from '../src/drawing-latex';
import {compileDrawingFunction} from '../src/drawing-expression';
describe('equation editor to function plot',()=>{
  it.each([
    [String.raw`\frac{x^2}{2}`,4,8],[String.raw`y=\sqrt{x}+\pi`,9,3+Math.PI],
    [String.raw`\sin\left(x\right)`,Math.PI/2,1],[String.raw`\sin^{2}x`,Math.PI/4,.5],
    [String.raw`\log_{2}x`,8,3],[String.raw`\sqrt[3]{x}`,8,2],[String.raw`\left|x\right|`,-3,3],
    ['2x+1',4,9],[String.raw`\frac{\sqrt{x}}2`,16,2],[String.raw`\mathrm{e}^{x}`,2,Math.exp(2)],
    [String.raw`f(x)=\operatorname{cos}(x)`,0,1]
  ])('plots %s using math notation',(latex,x,result)=>{expect(compileDrawingFunction(drawingLatexExpression(latex))(x)).toBeCloseTo(result);});
  it.each([String.raw`\text{hello}`,String.raw`\operatorname{constructor}(x)`,String.raw`\frac{x}{}`,String.raw`\sqrt{`,String.raw`x_{1}`,String.raw`\int x`,String.raw`x^#?`])('rejects unsupported or incomplete notation %s',latex=>expect(()=>drawingLatexExpression(latex)).toThrow());
});

describe('compact MathLive fraction arguments',()=>{
  it.each([[String.raw`\frac13`,1/3],[String.raw`y=\frac12`,.5],[String.raw`\frac1{12}`,1/12],[String.raw`\frac{12}3`,4],[String.raw`\frac\frac12{3}`,1/6]])('reads one TeX atom per unbraced fraction argument: %s',(latex,value)=>{expect(compileDrawingFunction(drawingLatexExpression(latex))(0)).toBeCloseTo(value);});
});
