import {compileDrawingFunction} from './drawing-expression';
/** Convert the equation editor's mathematical TeX into the bounded plot expression grammar. */
export function drawingLatexToPlain(source:string):string{
  if(source.length>600)throw new Error('Keep this equation within 600 characters.');
  const text=source.replace(/\\(?:left|right|displaystyle|textstyle)\b/g,'').replace(/\\[,;! ]/g,' ');let i=0;
  const skip=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
  const functions=new Set(['sin','cos','tan','asin','acos','atan','sqrt','abs','exp','ln','log','floor','ceil']);
  function sequence(end?:string):string{let value='';while(i<text.length){skip();if(i>=text.length)break;if(end&&text[i]===end){i++;return value;}if('})]'.includes(text[i]))throw new Error('Check the equation brackets.');value+=operand();}if(end)throw new Error('Close each equation bracket.');return value;}
  function argument():string{skip();if(text[i]==='{'){i++;return sequence('}');}if(text[i]==='('){i++;return sequence(')');}return operand();}
  function applyFunction(name:string):string{
    skip();let power:string|undefined,base:string|undefined;if(text[i]==='^'){i++;power=argument();skip();}if(text[i]==='_'){i++;base=argument();}
    const arg=argument();if(!arg)throw new Error(`Complete ${name}'s argument.`);
    const call=base&&name==='log'?`(ln(${arg})/ln(${base}))`:`${name}(${arg})`;return power?`(${call})^(${power})`:call;
  }
  function operand():string{
    skip();const char=text[i++];if(!char)throw new Error('Complete the equation.');let value:string;
    if(char==='{')value=`(${sequence('}')})`;
    else if(char==='[')value=`[${sequence(']')}]`;
    else if(char==='(')value=`(${sequence(')')})`;
    else if(char==='|')value=`abs(${sequence('|')})`;
    else if(char==='\\'){
      const match=/^[A-Za-z]+/.exec(text.slice(i));if(!match)throw new Error('Complete the mathematical expression.');const command=match[0];i+=command.length;
      if(command==='frac'||command==='dfrac'||command==='tfrac'){const a=argument(),b=argument();value=`((${a})/(${b}))`;}
      else if(command==='sqrt'){skip();let root='2';if(text[i]==='['){i++;root=sequence(']');}const arg=argument();value=root==='2'?`sqrt(${arg})`:`((${arg})^(1/(${root})))`;}
      else if(command==='pi')value='pi';
      else if(['ldots','dots','cdots'].includes(command))value='...';
      else if(['le','leq'].includes(command))value='<=';
      else if(['ge','geq'].includes(command))value='>=';
      else if(command==='lt')value='<';
      else if(command==='gt')value='>';
      else if(['arcsin','arccos','arctan'].includes(command))value=applyFunction(command.replace('arc','a'));
      else if(command==='cdot'||command==='times')value='*';
      else if(command==='div')value='/';
      else if(command==='operatorname'){const name=argument();if(!functions.has(name))throw new Error(`Unsupported function: ${name}`);value=applyFunction(name);}
      else if(command==='mathrm'){const symbol=argument();if(symbol!=='e'&&symbol!=='pi')throw new Error('Use x, pi or e.');value=symbol;}
      else if(functions.has(command))value=applyFunction(command);
      else throw new Error(`Unsupported notation: ${command}. Use arithmetic, equations or inequalities.`);
    }else if(/[A-Za-z]/.test(char)){const rest=/^[A-Za-z]*/.exec(text.slice(i))![0];value=char+rest;i+=rest.length;}
    else if(/[\d.]/.test(char)){const rest=/^[\d.]*/.exec(text.slice(i))![0];value=char+rest;i+=rest.length;}
    else if('+-*/=,<>'.includes(char))value=char;
    else if(char==='^'){value=`^(${argument()})`;return value;}
    else if(char==='−')value='-';
    else if(char==='π')value='pi';
    else throw new Error('Use numbers, x, fractions, roots and functions.');
    skip();if(text[i]==='^'){i++;value+=`^(${argument()})`;}return value;
  }
  return sequence().trim();
}

export function drawingLatexExpression(source:string):string{const expression=drawingLatexToPlain(source);compileDrawingFunction(expression);return expression;}
