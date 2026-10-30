const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);};
function multiply(a,b){const c=new Float32Array(16);for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(let k=0;k<4;k++)c[x*4+y]+=a[k*4+y]*b[x*4+k];return c;}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function lookAt(eye,target,up=[0,1,0]){const z=unit(sub(eye,target)),x=unit(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function model(pos,scale,rot){
  const [x,y,z]=rot.map(v=>v*Math.PI/180);const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  return new Float32Array([(cz*cy)*scale[0],(sz*cy)*scale[0],(-sy)*scale[0],0,(cz*sy*sx-sz*cx)*scale[1],(sz*sy*sx+cz*cx)*scale[1],(cy*sx)*scale[1],0,(cz*sy*cx+sz*sx)*scale[2],(sz*sy*cx-cz*sx)*scale[2],(cy*cx)*scale[2],0,...pos,1]);
}

export {clamp,smooth,add,sub,dot,cross,unit,multiply,perspective,ortho,lookAt,model};
