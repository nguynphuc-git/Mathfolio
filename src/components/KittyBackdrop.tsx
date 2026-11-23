import type {CSSProperties} from 'react';
import {createPortal} from 'react-dom';

// Decorative only: no timers, interaction, or content in the reading/focus order.
const blossoms = Array.from({length:14},(_,index)=>({
  left:`${(index*29+4)%100}%`, size:`${18+(index*7)%19}px`,
  duration:`${34+(index*11)%31}s`, delay:`-${(index*13)%60}s`,
  drift:`${index%2?-1:1}00px`, turn:`${index%2?-1:1}80deg`,
}));

export function KittyBackdrop(){
  return createPortal(<div className="kitty-backdrop" aria-hidden="true">
    {blossoms.map((flower,index)=><span key={index} className="sakura-blossom" style={{
      left:flower.left,'--flower-size':flower.size,'--flower-time':flower.duration,
      '--flower-delay':flower.delay,'--flower-drift':flower.drift,'--flower-turn':flower.turn,
    } as CSSProperties}><img src="/kitty/blossom.svg" alt="" draggable={false}/></span>)}
  </div>,document.body);
}
