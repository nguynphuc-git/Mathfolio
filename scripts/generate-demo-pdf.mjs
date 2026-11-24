import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Small, dependency-free PDF renderer for the demo plan. It embeds a Unicode
// TrueType font so Vietnamese text remains selectable and searchable.
const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'scripts/demo-plan.html');
const input=fs.readFileSync(source,'utf8');
const font=fs.readFileSync(path.join(root,'scripts/fonts/JetBrainsMono-Regular.ttf'));
const output=path.join(root,'docs/Mathfolio-demo-3-phut.pdf');
const u16=(p)=>font.readUInt16BE(p),u32=(p)=>font.readUInt32BE(p);
const tables=new Map();
for(let i=0,n=u16(4);i<n;i++){const p=12+16*i;tables.set(font.toString('ascii',p,p+4),{offset:u32(p+8),length:u32(p+12)});}
const head=tables.get('head'),hhea=tables.get('hhea'),maxp=tables.get('maxp'),hmtx=tables.get('hmtx'),cmap=tables.get('cmap');
if(![head,hhea,maxp,hmtx,cmap].every(Boolean))throw Error('Font lacks required TrueType tables');
const units=u16(head.offset+18),numMetrics=u16(hhea.offset+34),glyphs=u16(maxp.offset+4);
const metric=n=>Math.round(n*1000/units);
const fontBox=[36,38,40,42].map(p=>metric(font.readInt16BE(head.offset+p)));
const ascent=metric(font.readInt16BE(hhea.offset+4)),descent=metric(font.readInt16BE(hhea.offset+6));
let cmapOffset=0;for(let i=0,n=u16(cmap.offset+2);i<n;i++){const p=cmap.offset+4+i*8,platform=u16(p),encoding=u16(p+2),offset=u32(p+4);if(platform===3&&(encoding===1||encoding===10)&&u16(cmap.offset+offset)===4){cmapOffset=cmap.offset+offset;break;}}
if(!cmapOffset)throw Error('No BMP cmap in font');
const segmentCount=u16(cmapOffset+6)/2,endAt=cmapOffset+14,startAt=endAt+2*segmentCount+2,deltaAt=startAt+2*segmentCount,rangeAt=deltaAt+2*segmentCount;
function gid(code){let lo=0,hi=segmentCount-1;while(lo<=hi){const m=(lo+hi)>>1,end=u16(endAt+m*2);if(code>end)lo=m+1;else hi=m-1;}if(lo>=segmentCount||code<u16(startAt+lo*2))return 0;const delta=u16(deltaAt+lo*2),range=u16(rangeAt+lo*2);if(!range)return(code+delta)&65535;const p=rangeAt+lo*2+range+2*(code-u16(startAt+lo*2));if(p>=font.length)return 0;const g=u16(p);return g?(g+delta)&65535:0;}
function width(code){const g=Math.min(gid(code),glyphs-1),metric=Math.min(g,numMetrics-1);return u16(hmtx.offset+4*metric)*1000/units;}
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&nbsp;':' ','&#39;':"'"}[m]));
let html=input.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<head[\s\S]*?<\/head>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<header class="web-only"[\s\S]*?<\/header>/gi,'');
const blocks=[];let buffer='',kind='body',anchors=[],openAnchor=null,container='';
function flush(){const value=decode(buffer).replace(/\s+/g,' ').trim();if(value)blocks.push({kind,text:value,links:anchors});buffer='';kind='body';anchors=[];openAnchor=null;}
for(const token of html.match(/<[^>]*>|[^<]+/g)??[]){
 if(!token.startsWith('<')){buffer+=token;continue;}
 if(/^<a\b/i.test(token)){openAnchor={href:token.match(/href="([^"]+)"/i)?.[1],start:buffer.length};continue;}
 if(/^<\/a\s*>/i.test(token)){if(openAnchor?.href){const label=decode(buffer.slice(openAnchor.start)).replace(/\s+/g,' ').trim();if(label)anchors.push({label,href:openAnchor.href});}openAnchor=null;continue;}
 if(/^<section class="page"/i.test(token)){flush();blocks.push({kind:'page'});continue;}
 if(/^<div class="scene"/i.test(token)){flush();container='scene';continue;}
 if(/^<div class="note"/i.test(token)){flush();container='note';continue;}
 if(/^<p\b/i.test(token)){flush();kind=/class="note"/i.test(token)||container==='note'?'note':container==='scene'?'sceneBody':'body';continue;}
 if(/^<h[123]\b/i.test(token)){flush();kind=token.slice(1,3);continue;}
 if(/^<li\b/i.test(token)){flush();buffer='• ';continue;}
 if(/^<td\b/i.test(token)){if(buffer.trim())buffer+='  |  ';continue;}
 if(/^<br\s*\/?/i.test(token)){buffer+=' · ';continue;}
 if(/^<\/div\s*>/i.test(token)){flush();container='';continue;}
 if(/^<\/(?:p|li|h1|h2|h3|tr|div|section|table|ol|ul)\s*>/i.test(token)){flush();continue;}
}
flush();
const pages=[[]];let y=796;
function next(){pages.push([]);y=796;}
function add(text,size=9.1,space=2.4,links=[],kind='body'){const lineHeight=size*1.5;if(y-lineHeight<48)next();pages.at(-1).push({text,y,size,links,kind});y-=lineHeight+space;}
function wrap(text,size){const max=490,words=text.split(/\s+/),out=[];let line='';
 for(const word of words){let trial=line?line+' '+word:word;let w=0;for(const c of trial)w+=width(c.codePointAt(0))*size/1000;if(w>max&&line){out.push(line);line=word;}else line=trial;}if(line)out.push(line);return out;
}
for(const b of blocks){if(b.kind==='page'){if(pages.at(-1).length)next();continue;}const size=b.kind==='h1'?20:b.kind==='h2'?14:b.kind==='h3'?11:9.1;const space=b.kind==='h1'?6:b.kind==='h2'?5:b.kind==='h3'?3:1.8;for(const line of wrap(b.text,size))add(line,size,space,(b.links??[]).filter(link=>line.includes(link.label)),b.kind);if(b.kind!=='body')y-=3;}
if(!pages.at(-1).length)pages.pop();
const cidMap=Buffer.alloc(65536*2),used=new Set();
for(const page of pages)for(const line of page)for(const c of line.text){const cp=c.codePointAt(0);if(cp<=65535){used.add(cp);cidMap.writeUInt16BE(gid(cp),cp*2);}}
const missing=[...used].filter(cp=>gid(cp)===0);
if(missing.length)throw Error(`Embedded font lacks glyphs: ${missing.map(cp=>String.fromCodePoint(cp)).join(' ')}`);
function hex(s){let out='';for(const c of s){const cp=c.codePointAt(0);out+=cp<=65535?cp.toString(16).padStart(4,'0'):'003F';}return out.toUpperCase();}
const objects=[null];const push=s=>{objects.push(s);return objects.length-1;};
const fontStream=push({stream:zlib.deflateSync(font),dict:`/Filter /FlateDecode /Length1 ${font.length}`});
const cidStream=push({stream:zlib.deflateSync(cidMap),dict:'/Filter /FlateDecode'});
const descriptor=push(`<< /Type /FontDescriptor /FontName /JetBrainsMono-Regular /Flags 33 /FontBBox [${fontBox.join(' ')}] /ItalicAngle 0 /Ascent ${ascent} /Descent ${descent} /CapHeight ${ascent} /StemV 80 /FontFile2 ${fontStream} 0 R >>`);
const widths=[...used].sort((a,b)=>a-b).map(cp=>`${cp} [${Math.round(width(cp))}]`).join(' ');
const descendant=push(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /JetBrainsMono-Regular /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 600 /W [${widths}] /CIDToGIDMap ${cidStream} 0 R >>`);
const codepoints=[...used].sort((a,b)=>a-b);
const mappings=[];
for(let i=0;i<codepoints.length;i+=100){const chunk=codepoints.slice(i,i+100);mappings.push(`${chunk.length} beginbfchar\n${chunk.map(cp=>`<${cp.toString(16).padStart(4,'0')}> <${cp.toString(16).padStart(4,'0')}>`).join('\n')}\nendbfchar`);}
const cmapText=`/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ${mappings.join('\n')} endcmap CMapName currentdict /CMap defineresource pop end end`;
const unicode=push({stream:Buffer.from(cmapText)});
const fontObj=push(`<< /Type /Font /Subtype /Type0 /BaseFont /JetBrainsMono-Regular /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${unicode} 0 R >>`);
const pageRefs=[];const pagesObj=push('');
for(let i=0;i<pages.length;i++){const page=pages[i];let commands='q 1 1 1 rg 0 0 595.28 841.89 re f Q\n',annotations=[];for(const line of page){const color=line.kind==='h1'?'0.08 0.24 0.48':line.kind==='h2'?'0.08 0.32 0.59':line.kind==='h3'?'0.13 0.36 0.55':'0.13 0.17 0.23';if(line.kind==='h2')commands+=`q 0.78 0.85 0.92 RG 0.7 w 48 ${(line.y-7).toFixed(1)} m 547 ${(line.y-7).toFixed(1)} l S Q\n`;if(line.kind==='h3')commands+=`q 0.16 0.43 0.69 rg 48 ${(line.y-3).toFixed(1)} 3 16 re f Q\n`;if(line.kind==='sceneBody'||line.kind==='note')commands+=`q ${line.kind==='note'?'1 0.97 0.88':'0.94 0.97 0.99'} rg 45 ${(line.y-4).toFixed(1)} 505 16 re f Q\n`;commands+=`q ${color} rg BT /F1 ${line.size} Tf 48 ${line.y.toFixed(1)} Td <${hex(line.text)}> Tj ET Q\n`;for(const link of line.links){const at=line.text.indexOf(link.label);if(at<0)continue;const measure=s=>[...s].reduce((n,c)=>n+width(c.codePointAt(0))*line.size/1000,0),x0=48+measure(line.text.slice(0,at)),x1=x0+measure(link.label),url=link.href;const escaped=url.replace(/[\\()]/g,'\\$&');annotations.push(push(`<< /Type /Annot /Subtype /Link /Rect [${x0.toFixed(1)} ${(line.y-2).toFixed(1)} ${x1.toFixed(1)} ${(line.y+line.size+2).toFixed(1)}] /Border [0 0 0] /A << /S /URI /URI (${escaped}) >> >>`));}}
 const footer=`Mathfolio • Kế hoạch demo 3 phút    |    ${i+1}/${pages.length}`;
 commands+=`BT /F1 8 Tf 48 28 Td <${hex(footer)}> Tj ET\n`;
 const content=push({stream:Buffer.from(commands)});const pageObj=push(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${content} 0 R ${annotations.length?`/Annots [${annotations.map(x=>x+' 0 R').join(' ')}]`:''} >>`);pageRefs.push(pageObj);
}
objects[pagesObj]=`<< /Type /Pages /Kids [${pageRefs.map(x=>x+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`;
const catalog=push(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
const parts=[Buffer.from('%PDF-1.7\n%âãÏÓ\n','binary')],offsets=[0];let offset=parts[0].length;
for(let i=1;i<objects.length;i++){offsets[i]=offset;const obj=objects[i];let bytes;if(typeof obj==='string')bytes=Buffer.from(`${i} 0 obj\n${obj}\nendobj\n`);else{const start=Buffer.from(`${i} 0 obj\n<< /Length ${obj.stream.length} ${obj.dict??''} >>\nstream\n`),end=Buffer.from('\nendstream\nendobj\n');bytes=Buffer.concat([start,obj.stream,end]);}parts.push(bytes);offset+=bytes.length;}
const xref=offset;let table=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
parts.push(Buffer.from(table+`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
fs.writeFileSync(output,Buffer.concat(parts));console.log(`Wrote ${output} (${pages.length} pages)`);
