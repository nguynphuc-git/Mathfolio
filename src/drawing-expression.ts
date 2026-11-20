/** A small arithmetic parser for graphing. User input is never executed as JavaScript. */
export type DrawingFunction=(x:number)=>number;
const functions:Record<string,(x:number)=>number>={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,ln:Math.log,log:Math.log10,floor:Math.floor,ceil:Math.ceil};
export function compileDrawingFunction(source:string):DrawingFunction{
  const text=source.trim().replace(/^(?:y|f\(x\))\s*=\s*/i,'').replace(/π/g,'pi').replace(/−/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/²/g,'^2').replace(/³/g,'^3').toLowerCase();
  if(!text||text.length>300)throw new Error('Enter a function of x, up to 300 characters.');
  const tokens:string[]=[];let position=0;
  while(position<text.length){if(/\s/.test(text[position])){position++;continue;}const match=/^(?:\d*\.\d+(?:e[+-]?\d+)?|\d+(?:\.\d*)?(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^])/.exec(text.slice(position));if(!match)throw new Error('Use numbers, x, parentheses and arithmetic operators.');tokens.push(match[0]);position+=match[0].length;if(tokens.length>180)throw new Error('Simplify this expression.');}
  let i=0,depth=0;
  const constant=(value:number):DrawingFunction=>()=>value;
  function primary():DrawingFunction{
    if(++depth>40)throw new Error('Too many nested parentheses.');
    const token=tokens[i++];let result:DrawingFunction;
    if(token==='('){result=expression();if(tokens[i++]!==')')throw new Error('Close each parenthesis.');}
    else if(token==='x')result=x=>x;
    else if(token==='pi')result=constant(Math.PI);
    else if(token==='e')result=constant(Math.E);
    else if(token&&Object.hasOwn(functions,token)){if(tokens[i++]!=='(')throw new Error(`Use ${token}(x) with parentheses.`);const argument=expression();if(tokens[i++]!==')')throw new Error('Close each parenthesis.');result=x=>functions[token](argument(x));}
    else if(token&&/^\d|^\./.test(token)){const value=Number(token);if(!Number.isFinite(value))throw new Error('Use finite numbers.');result=constant(value);}
    else throw new Error(token?`Unknown term: ${token}`:'Complete the expression.');
    depth--;return result;
  }
  function power():DrawingFunction{const left=primary();if(tokens[i]==='^'){i++;const right=unary();return x=>left(x)**right(x);}return left;}
  function unary():DrawingFunction{if(tokens[i]==='+'){i++;return unary();}if(tokens[i]==='-'){i++;const right=unary();return x=>-right(x);}return power();}
  function product():DrawingFunction{let left=unary();while(i<tokens.length){const token=tokens[i];const implicit=token==='('||/^[a-z\d.]/.test(token);if(token!=='*'&&token!=='/'&&!implicit)break;if(!implicit)i++;const a=left,b=unary();left=token==='/'?x=>a(x)/b(x):x=>a(x)*b(x);}return left;}
  function expression():DrawingFunction{let left=product();while(tokens[i]==='+'||tokens[i]==='-'){const operator=tokens[i++],a=left,b=product();left=operator==='+'?x=>a(x)+b(x):x=>a(x)-b(x);}return left;}
  const result=expression();if(i!==tokens.length)throw new Error('Check the parentheses and operators.');return result;
}
