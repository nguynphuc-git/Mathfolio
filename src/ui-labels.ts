export function sourceLabel(source?:string):string {
  const key=source?.toLowerCase()??'';
  if(key==='local_reference')return 'Verified formula';
  if(key.includes('device')||key==='local')return 'Local AI';
  if(key.includes('cloud'))return 'Cloud AI';
  return 'AI';
}
