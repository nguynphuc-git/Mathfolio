import {drawingLatexToPlain} from './drawing-latex';
import type {DrawingEquation,DrawingView} from './drawing';
type Value=number|number[];
type Scope=Record<string,Value>;
type Node={kind:'number';value:number}|{kind:'variable';name:string}|{kind:'unary';op:string;value:Node}|{kind:'binary';op:string;a:Node;b:Node}|{kind:'call';name:string;value:Node}|{kind:'list';values:Node[]}|{kind:'range';start:Node;second?:Node;end:Node};
export type RelationOperator='='|'<'|'>'|'<='|'>=';
export interface PreparedEquation {id:string;kind:'empty'|'parameter'|'relation'|'error';error?:string;parameter?:string;value?:Value;missing?:string[];operator?:RelationOperator;evaluate?:(x:number,y:number)=>number[]}
const unaryFunctions:Record<string,(x:number)=>number>={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,ln:Math.log,log:Math.log10,floor:Math.floor,ceil:Math.ceil};
const maxList=25;
function variables(node:Node,out=new Set<string>()):Set<string>{switch(node.kind){case 'variable':out.add(node.name);break;case 'unary':case 'call':variables(node.value,out);break;case 'binary':variables(node.a,out);variables(node.b,out);break;case 'list':node.values.forEach(value=>variables(value,out));break;case 'range':variables(node.start,out);variables(node.end,out);if(node.second)variables(node.second,out);}return out;}
function scalar(value:Value):number{if(Array.isArray(value))throw new Error('Use a number for a range endpoint.');return value;}
function combine(a:Value,b:Value,op:string):Value{
  const calculate=(x:number,y:number)=>op==='+'?x+y:op==='-'?x-y:op==='*'?x*y:op==='/'?x/y:x**y;
  if(!Array.isArray(a)&&!Array.isArray(b))return calculate(a,b);
  if(Array.isArray(a)&&Array.isArray(b)){if(a.length!==b.length)throw new Error('Lists in one expression must have the same length.');return a.map((value,index)=>calculate(value,b[index]));}
  return Array.isArray(a)?a.map(value=>calculate(value,b as number)):(b as number[]).map(value=>calculate(a as number,value));
}
function evaluate(node:Node,scope:Scope):Value{
  switch(node.kind){
    case 'number':return node.value;
    case 'variable':if(!Object.hasOwn(scope,node.name))throw new Error(`Define ${node.name} on another line.`);return scope[node.name];
    case 'unary':{const value=evaluate(node.value,scope);return Array.isArray(value)?value.map(x=>node.op==='-'?-x:x):node.op==='-'?-value:value;}
    case 'binary':return combine(evaluate(node.a,scope),evaluate(node.b,scope),node.op);
    case 'call':{const value=evaluate(node.value,scope);return Array.isArray(value)?value.map(unaryFunctions[node.name]):unaryFunctions[node.name](value);}
    case 'list':return node.values.map(value=>scalar(evaluate(value,scope)));
    case 'range':{const start=scalar(evaluate(node.start,scope)),end=scalar(evaluate(node.end,scope)),step=node.second?scalar(evaluate(node.second,scope))-start:end>=start?1:-1;if(![start,end,step].every(Number.isFinite)||step===0||(end-start)*step<0)throw new Error('Check the range start, step and end.');const count=Math.floor((end-start)/step+1e-9)+1;if(count<1||count>maxList)throw new Error(`Use at most ${maxList} values in a list.`);return Array.from({length:count},(_,i)=>start+i*step);}
  }
}
/** Fold parameter-only expressions before sampling the graph. */
function specialize(node:Node,scope:Scope):Node{
  if(![...variables(node)].some(name=>name==='x'||name==='y')){const value=evaluate(node,scope);return Array.isArray(value)?{kind:'list',values:value.map(value=>({kind:'number',value}))}:{kind:'number',value};}
  switch(node.kind){case 'binary':return {...node,a:specialize(node.a,scope),b:specialize(node.b,scope)};case 'unary':case 'call':return {...node,value:specialize(node.value,scope)};case 'list':return {...node,values:node.values.map(value=>specialize(value,scope))};case 'range':throw new Error('Range endpoints can use numbers or parameters, not x or y.');default:return node;}
}
interface Parsed {parameter?:string;left:Node;right:Node;operator:RelationOperator;vars:Set<string>}
const cache=new Map<string,Parsed>();
function parse(source:string):Parsed{
  const existing=cache.get(source);if(existing)return existing;
  const normalized=source.replace(/^f\(x\)\s*=/,'y=').replace(/−/g,'-').toLowerCase();if(!normalized||normalized.length>1200)throw new Error('Enter an expression of up to 600 characters.');
  const tokens:string[]=[];let position=0;
  while(position<normalized.length){if(/\s/.test(normalized[position])){position++;continue;}const match=/^(?:\.\.\.|\d*\.\d+(?:e[+-]?\d+)?|\d+(?:\.\d*)?(?:e[+-]?\d+)?|[a-z]+|<=|>=|[()[\],+\-*/^=<>])/.exec(normalized.slice(position));if(!match)throw new Error('Check the equation notation.');const term=match[0];if(/^[a-z]+$/.test(term)&&!Object.hasOwn(unaryFunctions,term)&&term!=='pi')tokens.push(...term);else tokens.push(term);position+=term.length;if(tokens.length>240)throw new Error('Simplify this expression.');}
  let i=0,depth=0;
  function primary():Node{
    if(++depth>40)throw new Error('Too many nested brackets.');const token=tokens[i++];let node:Node;
    if(token==='('){node=expression();if(tokens[i++]!==')')throw new Error('Close each parenthesis.');}
    else if(token==='['){const values:Node[]=[expression()];let range:Node|undefined;while(tokens[i]===','){i++;if(tokens[i]==='...'){i++;if(tokens[i]!==',')throw new Error('Write a range like [-5,...,5].');i++;const end=expression();if(values.length>2)throw new Error('A range needs a start, optional second value, and end.');range={kind:'range',start:values[0],second:values[1],end};break;}values.push(expression());if(values.length>maxList)throw new Error(`Use at most ${maxList} values in a list.`);}if(tokens[i++]!==']')throw new Error('Close each list bracket.');node=range??{kind:'list',values};}
    else if(token&&Object.hasOwn(unaryFunctions,token)){if(tokens[i++]!=='(')throw new Error(`Use ${token}(...) with parentheses.`);const value=expression();if(tokens[i++]!==')')throw new Error('Close each parenthesis.');node={kind:'call',name:token,value};}
    else if(token==='pi'||token==='e')node={kind:'number',value:token==='pi'?Math.PI:Math.E};
    else if(token&&/^[a-z]$/.test(token))node={kind:'variable',name:token};
    else if(token&&/^[\d.]/.test(token)){const value=Number(token);if(!Number.isFinite(value))throw new Error('Use finite numbers.');node={kind:'number',value};}
    else throw new Error(token?`Check the symbol ${token}.`:'Complete the expression.');depth--;return node;
  }
  function power():Node{const a=primary();if(tokens[i]==='^'){i++;return {kind:'binary',op:'^',a,b:unary()};}return a;}
  function unary():Node{if(tokens[i]==='+'||tokens[i]==='-')return {kind:'unary',op:tokens[i++],value:unary()};return power();}
  function product():Node{let node=unary();while(i<tokens.length){const token=tokens[i],implicit=token==='('||token==='['||/^[a-z\d.]/.test(token)&&token!=='...';if(token!=='*'&&token!=='/'&&!implicit)break;if(!implicit)i++;node={kind:'binary',op:token==='/'?'/':'*',a:node,b:unary()};}return node;}
  function expression():Node{let node=product();while(tokens[i]==='+'||tokens[i]==='-')node={kind:'binary',op:tokens[i++],a:node,b:product()};return node;}
  let left=expression(),right:Node,operator:RelationOperator='=';if(['=','<','>','<=','>='].includes(tokens[i])){operator=tokens[i++] as RelationOperator;right=expression();}else{right=left;left={kind:'variable',name:'y'};}
  if(i!==tokens.length)throw new Error('Use one equation or inequality per line.');
  const vars=new Set([...variables(left),...variables(right)]),parameter=operator==='='&&left.kind==='variable'&&left.name!=='x'&&left.name!=='y'?left.name:undefined;
  const result={left,right,operator,vars,parameter};if(cache.size>100)cache.delete(cache.keys().next().value!);cache.set(source,result);return result;
}
export function prepareDrawingEquations(rows:DrawingEquation[]):Map<string,PreparedEquation>{
  const results=new Map<string,PreparedEquation>(),parsed=new Map<string,Parsed>(),definitions=new Map<string,DrawingEquation[]>(),scope:Scope=Object.create(null);
  for(const row of rows){if(!row.latex.trim()){results.set(row.id,{id:row.id,kind:'empty'});continue;}try{const value=parse(drawingLatexToPlain(row.latex));parsed.set(row.id,value);if(value.parameter){const entries=definitions.get(value.parameter)??[];definitions.set(value.parameter,[...entries,row]);}}catch(error){results.set(row.id,{id:row.id,kind:'error',error:error instanceof Error?error.message:'Check the equation.'});}}
  function resolve(name:string,visiting=new Set<string>()):Value{
    if(Object.hasOwn(scope,name))return scope[name];const defs=definitions.get(name);if(!defs?.length)throw new Error(`Define ${name} on another line.`);if(defs.length>1)throw new Error(`${name} is defined more than once.`);if(visiting.has(name))throw new Error('Parameter definitions form a cycle.');const node=parsed.get(defs[0].id)!.right,vars=variables(node),next=new Set(visiting).add(name);if(vars.has('x')||vars.has('y'))throw new Error('A parameter value cannot depend on x or y.');for(const dependency of vars)scope[dependency]=resolve(dependency,next);const value=evaluate(node,scope);if((Array.isArray(value)?value:[value]).some(x=>!Number.isFinite(x)))throw new Error('Use a finite parameter value.');scope[name]=value;return value;
  }
  for(const row of rows){const value=parsed.get(row.id);if(!value)continue;try{
    if(value.parameter){results.set(row.id,{id:row.id,kind:'parameter',parameter:value.parameter,value:resolve(value.parameter)});continue;}
    const missing=[...value.vars].filter(name=>name!=='x'&&name!=='y'&&!definitions.has(name));if(missing.length){results.set(row.id,{id:row.id,kind:'error',missing,error:`Define ${missing.join(', ')} on another line.`});continue;}
    for(const name of value.vars)if(name!=='x'&&name!=='y')scope[name]=resolve(name);
    const a=specialize(value.left,scope),b=specialize(value.right,scope),local:Scope={x:0,y:0};const evaluator=(x:number,y:number)=>{local.x=x;local.y=y;const output=combine(evaluate(a,local),evaluate(b,local),'-');return Array.isArray(output)?output:[output];};evaluator(0,0);
    results.set(row.id,{id:row.id,kind:'relation',operator:value.operator,evaluate:evaluator});
  }catch(error){results.set(row.id,{id:row.id,kind:'error',error:error instanceof Error?error.message:'Check the equation.'});}}
  return results;
}
export interface RelationGeometry {paths:string[];fill:string}
export function drawingEquationGeometry(relation:PreparedEquation,view:DrawingView,offset={x:0,y:0}):RelationGeometry{
  if(relation.kind!=='relation'||!relation.evaluate)return {paths:[],fill:''};const {evaluate:fn}=relation,width=view.width??1000,height=view.height??640,nx=112,ny=Math.max(20,Math.min(180,Math.round(nx*height/width))),dx=width/nx,dy=height/ny;
  const world=(x:number,y:number)=>({x:view.cx+(x-width/2)/view.scale-offset.x,y:view.cy-(y-height/2)/view.scale-offset.y});
  const count=fn(0,0).length,grid:Float64Array[]=[];if(!count||count>maxList)return {paths:[],fill:''};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const p=world(i*dx,j*dy);grid.push(Float64Array.from(fn(p.x,p.y)));}
  const paths=Array.from({length:count},()=>''),cases:Record<number,number[][]>={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};let fill='';
  const fmt=(x:number)=>Number(x.toFixed(2));
  for(let j=0;j<ny;j++){let run=-1;
    for(let i=0;i<nx;i++){
      const corners=[{x:i*dx,y:j*dy},{x:(i+1)*dx,y:j*dy},{x:(i+1)*dx,y:(j+1)*dy},{x:i*dx,y:(j+1)*dy}],samples=[grid[j*(nx+1)+i],grid[j*(nx+1)+i+1],grid[(j+1)*(nx+1)+i+1],grid[(j+1)*(nx+1)+i]];
      for(let branch=0;branch<count;branch++){
        const values=samples.map(sample=>sample[branch]);if(values.some(value=>!Number.isFinite(value)))continue;const mask=values.reduce((bits,value,index)=>bits|(value>=0?1<<index:0),0);
        const edge=(index:number)=>{
          const next=(index+1)%4,a=corners[index],b=corners[next],va=values[index],vb=values[next];
          let t=va===vb ? .5 : va/(va-vb);
          const sample=(at:number)=>{const point={x:a.x+(b.x-a.x)*at,y:a.y+(b.y-a.y)*at},p=world(point.x,point.y);return {point,value:fn(p.x,p.y)[branch]};};
          let candidate=sample(t);const tolerance=Math.max(1e-7,Math.abs(va),Math.abs(vb))*.08+1e-6;
          // Refine nonlinear crossings near tangencies. A pole never converges to zero.
          if(!Number.isFinite(candidate.value)||Math.abs(candidate.value)>tolerance){let low=0,high=1,sign=va>=0;for(let iteration=0;iteration<12;iteration++){t=(low+high)/2;candidate=sample(t);if(Number.isFinite(candidate.value)&&Math.abs(candidate.value)<=tolerance)break;if((candidate.value>=0)===sign)low=t;else high=t;}}
          return Number.isFinite(candidate.value)&&Math.abs(candidate.value)<=tolerance?candidate.point:null;
        };
        for(const [a,b] of cases[mask]??[]){const start=edge(a),end=edge(b);if(start&&end)paths[branch]+=`M${fmt(start.x)} ${fmt(start.y)}L${fmt(end.x)} ${fmt(end.y)}`;}
      }
      let shaded=false;if(relation.operator!=='='){const p=world((i+.5)*dx,(j+.5)*dy);shaded=fn(p.x,p.y).some(value=>Number.isFinite(value)&&(relation.operator==='<'?value<0:relation.operator==='<='?value<=0:relation.operator==='>'?value>0:value>=0));}
      if(shaded&&run<0)run=i;if((!shaded||i===nx-1)&&run>=0){const end=shaded?i+1:i;fill+=`M${fmt(run*dx)} ${fmt(j*dy)}h${fmt((end-run)*dx)}v${fmt(dy)}h-${fmt((end-run)*dx)}Z`;run=-1;}
    }
  }
  return {paths:paths.filter(Boolean),fill};
}
