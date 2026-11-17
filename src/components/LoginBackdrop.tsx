const marks=['∑','∫','π','∞','√','∂','α','Δ','∇','∈','x²','θ','⊆','λ','⋃','ℝ'];
export function LoginBackdrop(){
  return <div className="login-math-backdrop" aria-hidden="true"><div className="login-halo halo-one"/><div className="login-halo halo-two"/>{marks.map((mark,index)=><span key={mark} style={{left:`${4+(index*29)%92}%`,top:`${6+(index*37)%82}%`,fontSize:`${26+(index%4)*12}px`,animationDuration:`${26+(index%5)*7}s`,animationDelay:`-${index*3.7}s`}}>{mark}</span>)}</div>;
}
