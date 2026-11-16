/** A modifier chord (Ctrl+C/S/...) must never count as a double Control tap. */
export function doubleControl(toggle:()=>void, now=()=>performance.now()) {
  let down=false, chord=false, previous:number|null=null;
  return {
    keydown(event:KeyboardEvent) {
      if(event.isComposing){this.reset();return;}
      if(event.key!=='Control'){if(down)chord=true;previous=null;return;}
      if(event.repeat||down)return;
      down=true;chord=event.altKey||event.metaKey||event.shiftKey;
      if(chord)previous=null;
    },
    keyup(event:KeyboardEvent) {
      if(event.key!=='Control'||!down)return;
      down=false;
      if(chord||event.isComposing||event.altKey||event.metaKey||event.shiftKey){previous=null;return;}
      const time=now();
      if(previous!==null&&time-previous<=350){previous=null;event.preventDefault();toggle();}
      else previous=time;
    },
    reset(){down=false;chord=false;previous=null;}
  };
}
