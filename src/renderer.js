// Trinity's single WebGL2 renderer. Song state and captions belong to the project adapter.
import {clamp,add,sub,dot,cross,unit,multiply,perspective,ortho,lookAt} from './math.js';
export async function createRenderer({canvas,book,shaders,width=canvas.width,height=canvas.height,quality={}}){
if(shaders.rendererABI!=='trinity-grwm-v2')throw new Error('Trinity requires shader ABI trinity-grwm-v2');
const W=width,H=height;canvas.width=W;canvas.height=H;
const shadowSize=quality.shadowSize??4096;
let cachedWorld,cachedTransforms,cachedLighting,cachedOrigin;
const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl)throw new Error('WebGL2 required');
const {vertex:vert,fragment:frag,depth:depthFrag}=shaders;
const [{createGlintRenderer},{createShowRenderer},{createMirrorEnvironment},{createLightingResources},{createBloomRenderer}]=await Promise.all(['glints','show','environment','lighting','bloom'].map(key=>import(/* @vite-ignore */ shaders.effects[key])));
const zero=[0,0,0,0];
const neutral={tint:[1,1,1],keyGain:1,fill:0,fog:0,glints:[],particles:[],showEnergy:0,colorA:[1,1,1],colorB:[1,1,1],beams:[]};
let frameOrigin=0;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(v,f){const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,v),fs=shader(gl.FRAGMENT_SHADER,f);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
const main=program(vert,frag), depth=program(vert,depthFrag);
const backdrop=program(shaders.backdropVertex,shaders.backdropFragment);
const uniforms=new Map();
function loc(p,n){const k=(p===main?'m:':'d:')+n;if(!uniforms.has(k))uniforms.set(k,gl.getUniformLocation(p,n));return uniforms.get(k);}
function u1(p,n,v){const l=loc(p,n);if(l!==null)gl.uniform1f(l,v);}
function u3(p,n,v){const l=loc(p,n);if(l!==null)gl.uniform3fv(l,v);}
function u2(p,n,v){const l=loc(p,n);if(l!==null)gl.uniform2fv(l,v);}
function u4(p,n,v){const l=loc(p,n);if(l!==null)gl.uniform4fv(l,v);}
function um(p,n,v){const l=loc(p,n);if(l!==null)gl.uniformMatrix4fv(l,false,v);}
function mesh(raw,node){
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(raw,node.vertex_offset??0,node.vertex_count*8),gl.STATIC_DRAW);
  for(const [i,n,offset] of [[0,3,0],[1,3,12],[2,2,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,32,offset);}
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(raw,node.index_offset,node.index_count),gl.STATIC_DRAW);
  gl.bindVertexArray(null);return {vao,vb,ib,count:node.index_count};
}
for(const world of book.worlds){const raw=world.meshData;for(const n of world.nodes)n.gpu=mesh(raw,n);}
const transitionRaw=book.transition.meshData;const transitionMesh=mesh(transitionRaw,book.transition);
const shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,shadowSize,shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const shadowBuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowBuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTexture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Shadow framebuffer incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
const reflectionTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,reflectionTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const reflectionDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,reflectionDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,W,H);
const reflectionBuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,reflectionBuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,reflectionTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,reflectionDepth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Reflection framebuffer incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
let reflectionInfo=null;
const glintRenderer=createGlintRenderer(gl);
const showRenderer=createShowRenderer(gl);
const mirrorEnvironment=createMirrorEnvironment(gl);
const lightingResources=createLightingResources(gl);
const bloomRenderer=createBloomRenderer(gl,W,H);
let environmentPass=false,environmentPosition=[0,.55,0],spotMatrices=[null,null];
let contactPoints=new Float32Array(96),contactSizes=new Float32Array(96),contactCount=0;
let atmosphere=neutral;
let inspectionFixture=false;
let reflectionClip=null;

function submit(p,node,m,viewProjection,lightMatrix,t,world,cam,light){
  gl.useProgram(p);um(p,'model',m.model);um(p,'view_projection',viewProjection);um(p,'light_matrix',lightMatrix);
  u4(p,'articulation',m.art);u4(p,'percussion',m.perc);u4(p,'voice',m.voice);u4(p,'extra',m.extra);u1(p,'local_time',t);
  u1(p,'deformability',node.deformability??0);
  if(p===main){u3(p,'color',node.color);u3(p,'accent',world.accent);u3(p,'background',world.background);u3(p,'camera_position',cam.eye);u3(p,'light_position',light);
    u1(p,'color_pattern',node.colorData?.pattern??-1);u1(p,'color_grain_metal',node.colorData?.grainMetal??0);u3(p,'color_secondary',node.colorData?.secondary??node.color);u2(p,'color_scale',node.colorData?.scale??[1,1]);u2(p,'color_offset',node.colorData?.offset??[0,0]);
    u1(p,'selection_highlight',!environmentPass&&node.highlight?1:0);
    u1(p,'roughness',node.rough);u1(p,'metalness',node.metal);u1(p,'gold_finish',node.gold_finish?1:0);u1(p,'material_kind',node.kind);u1(p,'opacity',1);u1(p,'exposure',1.12);
    u3(p,'lighting_tint',atmosphere.tint);u1(p,'key_gain',atmosphere.keyGain);u1(p,'musical_fill',atmosphere.fill);u1(p,'fog_density',atmosphere.fog);
    u3(p,'show_color_a',atmosphere.colorA);u3(p,'show_color_b',atmosphere.colorB);u1(p,'show_energy',atmosphere.showEnergy);
    u3(p,'show_origin',[0,0,-(world.index??0)*(book.camera?.world_spacing??0)]);
    u3(p,'show_target_a',atmosphere.beams[0]?.end??[0,-1,1]);u3(p,'show_target_b',atmosphere.beams[1]?.end??[0,-1,1]);
    u4(p,'show_cones',[atmosphere.beams[0]?.width??.6,atmosphere.beams[1]?.width??.6,atmosphere.beams[0]?.energy??0,atmosphere.beams[1]?.energy??0]);
    u4(p,'rig_lighting',inspectionFixture?zero:(m.lighting??zero));
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.uniform1i(loc(p,'shadow_map'),0);
    for(const [unit,name,target,matrixName,matrix] of [[2,'shadow_map_a',lightingResources.spotA,'light_matrix_a',spotMatrices[0]],[3,'shadow_map_b',lightingResources.spotB,'light_matrix_b',spotMatrices[1]]]){
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.uniform1i(loc(p,name),unit);if(matrix)um(p,matrixName,matrix);
    }
    gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_CUBE_MAP,environmentPass?lightingResources.fallback:lightingResources.environment);gl.uniform1i(loc(p,'environment_map'),4);
    u1(p,'environment_pass',environmentPass?1:0);u1(p,'environment_ready',lightingResources.ready?1:0);u3(p,'environment_position',environmentPosition);
    u1(p,'linear_capture',environmentPass?1:0);
    u1(p,'matte_support',node.matte_support??(['finished warm lacquer tabletop','stationary supporting surface'].includes(node.label)?1:0));
    gl.uniform1i(loc(p,'contact_count'),contactCount);gl.uniform4fv(loc(p,'contacts[0]'),contactPoints);gl.uniform4fv(loc(p,'contact_sizes[0]'),contactSizes);
    u1(p,'contact_receiver',['finished warm lacquer tabletop','stationary supporting surface'].includes(node.label)?1:0);
    const reflect=reflectionInfo?.node===node;u1(p,'reflection_enabled',reflect?1:0);
    u1(p,'reflection_pass',reflectionClip?1:0);u4(p,'reflection_clip',reflectionClip??zero);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,reflect?reflectionTexture:shadowTexture);gl.uniform1i(loc(p,'reflection_map'),1);
    if(reflect)um(p,'reflection_matrix',reflectionInfo.matrix);
  }
  gl.bindVertexArray(node.gpu.vao);gl.drawElements(gl.TRIANGLES,node.gpu.count,gl.UNSIGNED_INT,0);
}
function render({t,world,transforms,cam,projection,selectedRig=null,atmosphere:lighting,transition=null,originZ=0,noParticles=false,bloomStrength=0,contacts={points:new Float32Array(96),sizes:new Float32Array(96),count:0}}){
atmosphere={...neutral,...lighting};frameOrigin=originZ;
const visible=k=>!selectedRig||world.nodes[k].assembly===selectedRig.id;
  const vp=multiply(projection,cam.view);
  inspectionFixture=Boolean(selectedRig);
  const baseZ=originZ;
   const light=selectedRig?add(cam.target,[-3,6,5]):[-4.0,8.0,baseZ+6.0],lm=multiply(ortho(-6,6,-5,7,.1,30),lookAt(light,selectedRig?cam.target:[0,1,baseZ]));
  const spotOrigins=[[-2.9,4.9,baseZ-2.5],[2.9,4.9,baseZ-2.8]];
  spotMatrices=spotOrigins.map((origin,i)=>multiply(perspective(55*Math.PI/180,1,.15,25),lookAt(origin,add(atmosphere.beams[i]?.end??[0,-1,1],[0,0,baseZ]))));
  contactPoints.set(contacts.points);contactSizes.set(contacts.sizes);contactCount=contacts.count;
  gl.bindFramebuffer(gl.FRAMEBUFFER,shadowBuffer);gl.viewport(0,0,shadowSize,shadowSize);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,3);
  for(let k=0;k<world.nodes.length;k++)if(visible(k)&&world.nodes[k].kind!==7)submit(depth,world.nodes[k],transforms[k],lm,lm,t,world,cam,light);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  reflectionInfo=null;
  for(const [index,target] of [lightingResources.spotA,lightingResources.spotB].entries()){
    gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,target.size,target.size);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    for(let k=0;k<world.nodes.length;k++)if(visible(k)&&world.nodes[k].kind!==7)submit(depth,world.nodes[k],transforms[k],spotMatrices[index],spotMatrices[index],t,world,cam,spotOrigins[index]);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  // One local roughness-filtered probe of this actual lit set. Mirrors are
  // omitted to avoid recursion; glass is rendered transparently after solids.
  const refreshEnvironment=!quality.cacheEnvironment||!lightingResources.ready||cachedWorld!==world||cachedTransforms!==transforms||cachedLighting!==lighting||cachedOrigin!==originZ;
  if(refreshEnvironment){
  environmentPosition=[0,.55,baseZ];environmentPass=true;
  const cubeFaces=[[[1,0,0],[0,-1,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[0,0,1]],[[0,-1,0],[0,0,-1]],[[0,0,1],[0,-1,0]],[[0,0,-1],[0,-1,0]]];
  gl.bindFramebuffer(gl.FRAMEBUFFER,lightingResources.framebuffer);gl.viewport(0,0,lightingResources.size,lightingResources.size);
  for(let face=0;face<6;face++){
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_CUBE_MAP_POSITIVE_X+face,lightingResources.environment,0);gl.clearColor(.005,.005,.008,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const [direction,up]=cubeFaces[face],pc={eye:environmentPosition,target:add(environmentPosition,direction)},pv=multiply(perspective(Math.PI/2,1,.08,40),lookAt(pc.eye,pc.target,up));
    mirrorEnvironment.draw(pc,up,baseZ,atmosphere.showEnergy,{probe:true,light,show:atmosphere});
    for(let k=0;k<world.nodes.length;k++)if(visible(k)&&world.nodes[k].kind!==7&&!(world.nodes[k].kind===3&&/mirror/.test(world.nodes[k].label)))submit(main,world.nodes[k],transforms[k],pv,lm,t,world,pc,light);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    for(let k=0;k<world.nodes.length;k++)if(visible(k)&&world.nodes[k].kind===7)submit(main,world.nodes[k],transforms[k],pv,lm,t,world,pc,light);
    gl.depthMask(true);gl.disable(gl.BLEND);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_CUBE_MAP,lightingResources.environment);gl.generateMipmap(gl.TEXTURE_CUBE_MAP);lightingResources.ready=true;environmentPass=false;
  cachedWorld=world;cachedTransforms=transforms;cachedLighting=lighting;cachedOrigin=originZ;
  }
  // Matte tabletop: no planar reflection pass. Real mirror views follow below.
  const mirrorCandidates=world.nodes.map((n,i)=>({n,i})).filter(({n,i})=>visible(i)&&n.kind===3&&/mirror/.test(n.label));
  mirrorCandidates.sort((a,b)=>Math.abs(world.rigs[a.n.assembly].pos[0])-Math.abs(world.rigs[b.n.assembly].pos[0]));
  if(mirrorCandidates.length){
    const {n,i}=mirrorCandidates[0],m=transforms[i].model,center=n.surface_center;
    const point=[0,1,2].map(k=>m[k]*center[0]+m[4+k]*center[1]+m[8+k]*center[2]+m[12+k]);
    const localNormal=n.surface_normal??(n.label==='lid mirror'?[0,-1,0]:[0,0,1]);
    let normal=unit([0,1,2].map(k=>m[k]*localNormal[0]+m[4+k]*localNormal[1]+m[8+k]*localNormal[2]));
    if(dot(sub(cam.eye,point),normal)<0)normal=normal.map(x=>-x);
    const reflected=v=>sub(v,normal.map(q=>q*2*dot(sub(v,point),normal)));
    const reflectUp=sub([0,1,0],normal.map(q=>q*2*normal[1]));
    const rc={eye:reflected(cam.eye),target:reflected(cam.target)};const rvp=multiply(projection,lookAt(rc.eye,rc.target,reflectUp));
     const reflectionSky=world.background.map((v,k)=>v*atmosphere.tint[k]*(1-.65*atmosphere.showEnergy)+atmosphere.colorB[k]*atmosphere.showEnergy*.07);
     gl.bindFramebuffer(gl.FRAMEBUFFER,reflectionBuffer);gl.viewport(0,0,W,H);gl.clearColor(...reflectionSky.map(v=>Math.pow(v/(v+.8),1/2.2)),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    mirrorEnvironment.draw(rc,reflectUp,baseZ,atmosphere.showEnergy);
    reflectionClip=[...normal,-dot(normal,point)];
    // Mirror surfaces are omitted from the reflection pass: no recursion, no
    // feedback sampling, and no reference-image stand-in for the scene.
    for(let k=0;k<world.nodes.length;k++){const item=world.nodes[k];if(item.kind===7||/mirror/.test(item.label))continue;submit(main,item,transforms[k],rvp,lm,t,world,rc,light);}
    reflectionInfo={node:n,matrix:rvp};reflectionClip=null;
  }
  bloomRenderer.begin();
  const bg=world.background.map(v=>Math.pow(v/(v+.7),1/2.2));gl.clearColor(...bg,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.disable(gl.DEPTH_TEST);gl.useProgram(backdrop);gl.uniform3fv(gl.getUniformLocation(backdrop,'base'),world.background);gl.uniform3fv(gl.getUniformLocation(backdrop,'tint'),world.accent);
    gl.uniform3fv(gl.getUniformLocation(backdrop,'show_a'),atmosphere.colorA);gl.uniform3fv(gl.getUniformLocation(backdrop,'show_b'),atmosphere.colorB);gl.uniform1f(gl.getUniformLocation(backdrop,'energy'),atmosphere.showEnergy);gl.uniform1f(gl.getUniformLocation(backdrop,'scan'),t*Math.PI/3.2);
   gl.uniform3fv(gl.getUniformLocation(backdrop,'wall_camera'),cam.eye);gl.uniform3fv(gl.getUniformLocation(backdrop,'wall_target'),cam.target);gl.uniform1f(gl.getUniformLocation(backdrop,'wall_depth'),baseZ-4.8);
   gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);
  for(let k=0;k<world.nodes.length;k++)if(visible(k)&&world.nodes[k].kind!==7)submit(main,world.nodes[k],transforms[k],vp,lm,t,world,cam,light);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  for(let k=0;k<world.nodes.length;k++)if(visible(k)&&world.nodes[k].kind===7)submit(main,world.nodes[k],transforms[k],vp,lm,t,world,cam,light);
  gl.depthMask(true);gl.disable(gl.BLEND);
  const glintPoints=[];
  if(atmosphere.glints.length){
    const candidates=[];
    for(let k=0;k<world.nodes.length;k++){
      const node=world.nodes[k],m=transforms[k].model;
      for(const anchor of node.glint_anchors??[]){
        const point=[0,1,2].map(a=>m[a]*anchor.point[0]+m[4+a]*anchor.point[1]+m[8+a]*anchor.point[2]+m[12+a]);
        const normScale=[0,4,8].map(j=>m[j]*m[j]+m[j+1]*m[j+1]+m[j+2]*m[j+2]);
        const normal=unit([0,1,2].map(a=>m[a]*anchor.normal[0]/normScale[0]+m[4+a]*anchor.normal[1]/normScale[1]+m[8+a]*anchor.normal[2]/normScale[2]));
        if(dot(normal,unit(sub(cam.eye,point)))<.25)continue;
        const clip=[0,1,2,3].map(a=>vp[a]*point[0]+vp[4+a]*point[1]+vp[8+a]*point[2]+vp[12+a]);
        if(clip[3]<=0||Math.abs(clip[0]/clip[3])>.90||clip[1]/clip[3]<-.48||clip[1]/clip[3]>.90)continue;
        candidates.push(point);
      }
    }
    if(candidates.length)for(const g of atmosphere.glints){const point=candidates[Math.floor(g.seed*candidates.length)];glintPoints.push([...point,g.sizePx,g.energy,g.rotation]);}
   glintRenderer.draw(vp,glintPoints);
  }
   const renderedShow=showRenderer.draw(vp,[0,0,baseZ],cam.eye,noParticles?{...atmosphere,particles:[]}:atmosphere,{maps:[lightingResources.spotA.texture,lightingResources.spotB.texture],matrices:spotMatrices});

if(transition){submit(main,{...transition.node,gpu:transitionMesh},transition.transform,vp,lm,t,transition.world,cam,light);}
bloomRenderer.finish(bloomStrength);if(quality.synchronize!==false)gl.finish();const err=gl.getError();if(err!==gl.NO_ERROR)throw new Error(`WebGL error ${err} at ${t}`);
return {rendered_glints:glintPoints.length,renderedShow,bloomSettings:bloomRenderer.settings,reflection:reflectionInfo?{mirror:reflectionInfo.node.label}:null};
}
return {render,dispose(){bloomRenderer.dispose();mirrorEnvironment.dispose();lightingResources.dispose();glintRenderer.dispose();showRenderer.dispose();for(const w of book.worlds)for(const n of w.nodes){gl.deleteBuffer(n.gpu.vb);gl.deleteBuffer(n.gpu.ib);gl.deleteVertexArray(n.gpu.vao);}gl.deleteBuffer(transitionMesh.vb);gl.deleteBuffer(transitionMesh.ib);gl.deleteVertexArray(transitionMesh.vao);gl.deleteTexture(shadowTexture);gl.deleteFramebuffer(shadowBuffer);gl.deleteTexture(reflectionTexture);gl.deleteFramebuffer(reflectionBuffer);gl.deleteRenderbuffer(reflectionDepth);gl.deleteProgram(main);gl.deleteProgram(depth);gl.deleteProgram(backdrop);}};
}
