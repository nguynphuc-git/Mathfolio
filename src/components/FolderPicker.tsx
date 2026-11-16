import type {Notebook} from '../notebook';
export function FolderPicker({folders,selected,onChange,disabled=false}:{folders:Notebook['folders'];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean}){
  const custom=folders.filter(folder=>folder.id!=='general');
  return <fieldset className="folder-picker" disabled={disabled}><legend>Also save in folders</legend><p className="subtle">Every exercise appears in My exercises automatically. Choose any number of additional folders.</p>
    {custom.length?custom.map(folder=><label className="check" key={folder.id}><input type="checkbox" checked={selected.includes(folder.id)} onChange={event=>onChange(event.target.checked?[...selected,folder.id]:selected.filter(id=>id!==folder.id))}/>{folder.name}</label>):<p className="subtle">No additional folders yet.</p>}
  </fieldset>;
}
