// Current Trinity/Ymir format. Materials use their authored Ymir shader suites.
export function resolveColor(catalog,id){
  const color=catalog.assets.find(a=>a.type==='color'&&a.id===id);
  if(!color)throw new Error(`Unknown Color resource: ${id}`);
  const parameters={...color.parameters};
  for(const [channel,ref] of Object.entries(color.palette??{})){
    const entry=catalog.assets.find(a=>a.type==='color'&&a.id===ref&&a.parameters.pattern===-1);
    if(!entry||!['primary','secondary'].includes(channel))throw new Error(`Invalid palette reference in ${color.name}`);
    parameters[channel]=entry.parameters.primary;
  }
  return parameters;
}
async function request(url, binary=false) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Asset request failed: ${url} (${response.status})`);
  return binary?response.arrayBuffer():response.json();
}
export function validateMesh(raw,nodes) {
  for(const n of nodes){
    for(const key of ['vertex_offset','index_offset','vertex_count','index_count'])
      if(!Number.isInteger(n[key])||n[key]<0)throw new Error(`Invalid mesh field ${key}`);
    if(n.vertex_offset%4||n.index_offset%4||n.index_count%3||n.vertex_count<1||
       n.vertex_offset+n.vertex_count*32>raw.byteLength||n.index_offset+n.index_count*4>raw.byteLength)
      throw new Error('Invalid mesh range/alignment');
    const vv=new Float32Array(raw,n.vertex_offset,n.vertex_count*8);
    if(vv.some(v=>!Number.isFinite(v)))throw new Error('Non-finite vertex');
    const ii=new Uint32Array(raw,n.index_offset,n.index_count);
    if(ii.some(v=>v>=n.vertex_count))throw new Error('Index outside vertex buffer');
  }
}
async function verifiedMesh(url,hash){
  const raw=await request(url,true);
  if(hash){const bytes=await crypto.subtle.digest('SHA-256',raw);
    const actual=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
    if(actual!==hash)throw new Error(`Mesh checksum mismatch: ${url}`);}
  return raw;
}
export async function loadLibrary(base,{suiteManifest}={}){
  base=new URL(base,location.href);
  const catalog=await request(new URL('catalog.json',base));
  if(catalog.schemaVersion!==1)throw new Error(`Expected Ymir catalog schema 1; received ${catalog.schemaVersion}`);
  const materials=new Map(catalog.assets.filter(a=>a.type==='material').map(a=>[a.id,a]));
  const suiteURL=new URL(suiteManifest??catalog.defaultSuite??'materials/ymir-surfaces-v1/suite.json',base);
  const suite=await request(suiteURL);
  if(suite.rendererABI!=='trinity-grwm-v2')throw new Error(`Expected shader ABI trinity-grwm-v2; received ${suite.rendererABI}`);
  const source=async file=>{const r=await fetch(new URL(file,suiteURL));if(!r.ok)throw new Error(`Shader missing: ${file}`);return r.text();};
  const [vertex,fragment,depth]=await Promise.all([source(suite.vertex),source(suite.fragment),source(suite.depth)]);
  const shaders={vertex,fragment,depth,rendererABI:suite.rendererABI};
  if(suite.colorGenerators){const generators=await source(suite.colorGenerators);shaders.fragment=fragment.replace('/* YMIR_COLOR_GENERATORS */',generators);}
  if(suite.backdropVertex){shaders.backdropVertex=await source(suite.backdropVertex);shaders.backdropFragment=await source(suite.backdropFragment);}
  if(suite.effects)shaders.effects=Object.fromEntries(Object.entries(suite.effects).map(([key,file])=>[key,new URL(file,suiteURL).href]));
  const cache=new Map();
  const modelCache=new Map();
  async function modelResource(url){
    if(!modelCache.has(url.href))modelCache.set(url.href,(async()=>{
      const model=await request(url);
      if(model.type!=='model'||model.schemaVersion!==2)throw new Error(`Expected Ymir Model schema 2; received ${model.schemaVersion}`);
      const raw=await verifiedMesh(new URL(model.mesh,url),model.meshSha256);validateMesh(raw,model.parts);
      return {model,raw};
    })());
    return modelCache.get(url.href);
  }
  async function loadProp(manifest,{variant}={}){
    const url=new URL(manifest,base);
    const key=url.href+'#'+(variant??'');
    if(!cache.has(key))cache.set(key,(async()=>{
      const asset=await request(url);
      if(asset.schemaVersion!==3||asset.type!=='prop')throw new Error(`Expected Ymir Prop schema 3; received ${asset.schemaVersion}`);
      const selected=asset.variants?.find(v=>v.id===(variant??asset.defaultVariant));
      if(!selected)throw new Error(`Variant missing or deleted: ${variant??asset.defaultVariant}`);
      const modelURL=new URL(asset.model,base),{model,raw}=await modelResource(modelURL);
      if(model.type!=='model'||model.schemaVersion!==2||model.id!==asset.modelId)throw new Error('Invalid model reference');
      const pieces=new Map(model.parts.map(p=>[p.id,p]));
      const assignments=new Map([...(asset.slots??[]),...(selected.slots??[])].map(s=>[s.slotId,s]));
      const metadata=new Map((selected.partMetadata??[]).map(b=>[b.partId,b]));
      const nodes=asset.parts.map(p=>{
        const piece=pieces.get(p.partId),binding={...(metadata.get(p.partId)??{}),...assignments.get(piece?.slotId)};
        if(!piece||!assignments.has(piece.slotId))throw new Error(`Missing model part or surface assignment: ${p.partId}`);
        const {id,name,slotId,...geo}=piece;const {partId,...placement}=p;const {slotId:discard,...appearance}=binding;
        return {...geo,...placement,...appearance,partId:id,surfaceSlot:slotId};
      });
      validateMesh(raw,nodes);
      const resolved=nodes.map(n=>{
        const material=materials.get(n.material.id);
        if(!material)throw new Error(`Unknown material: ${n.material.id}`);
        if(material.suite!==suite.id||suite.profiles[material.profile]!==material.id)
          throw new Error(`Material ${material.id} belongs to suite ${material.suite}; selected suite is ${suite.id}`);
        const parameters={...material.parameters,...n.material.parameters};
        const colorId=n.color?.id??material.defaultColorId;
        if(colorId){const colorData=resolveColor(catalog,colorId);return {...n,...parameters,color:colorData.primary,colorData,kind:material.profile};}
        return {...n,...parameters,kind:material.profile};
      });
      return {asset:{...asset,mesh:model.mesh,meshSha256:model.meshSha256},nodes:resolved,raw};
    })());
    return cache.get(key);
  }
  async function loadModel(manifest){
    const url=new URL(manifest,base),{model:asset,raw}=await modelResource(url);
    const nodes=asset.parts.map(({id,...geometry})=>({pos:[0,0,0],rot:[0,0,0],scale:[1,1,1],...geometry,partId:id,surfaceSlot:geometry.slotId,label:geometry.name??id,deformability:0,kind:0,color:[.6,.6,.6],rough:.5,metal:0}));
    validateMesh(raw,nodes);
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const n of nodes){const v=new Float32Array(raw,n.vertex_offset,n.vertex_count*8);for(let i=0;i<v.length;i+=8)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[i+k]);hi[k]=Math.max(hi[k],v[i+k]);}}
    return {asset:{...asset,bounds:asset.bounds??[lo,hi]},nodes,raw};
  }
  return {catalog,loadProp,loadModel,shaders};
}
export async function loadScene(url){
  url=new URL(url,location.href);
  const scene=await request(url);
  if(scene.schemaVersion!==1||scene.rendererABI!=='trinity-grwm-v2')throw new Error(`Expected Trinity scene schema 1 with ABI trinity-grwm-v2; received schema ${scene.schemaVersion}, ABI ${scene.rendererABI}`);
  const library=await loadLibrary(new URL(scene.assetBase,url),{suiteManifest:scene.shaderSuite});
  const worlds=[];
  for(const w of scene.worlds){
    const chunks=[],nodes=[],rigs=[];let offset=0;
    for(const instance of w.instances){
      const prop=await library.loadProp(instance.asset,{variant:instance.variant});
      if(instance.nodeOverrides.length!==prop.nodes.length)throw new Error('Node override count mismatch');
      if(instance.rig.id!==rigs.length)throw new Error('Rig IDs must be consecutive');
      rigs.push(instance.rig);chunks.push(new Uint8Array(prop.raw));
      prop.nodes.forEach((n,i)=>nodes.push({...n,...instance.nodeOverrides[i],vertex_offset:n.vertex_offset+offset,index_offset:n.index_offset+offset}));
      offset+=prop.raw.byteLength;
    }
    nodes.sort((a,b)=>a.identity-b.identity);
    const raw=new Uint8Array(offset);let cursor=0;
    for(const chunk of chunks){raw.set(chunk,cursor);cursor+=chunk.length;}
    worlds.push({...w,rigs,nodes,meshData:raw.buffer});
  }
  let transition=null;
  if(scene.transition?.file){
    transition={...scene.transition,meshData:await request(new URL(scene.transition.file,new URL(scene.assetBase,url)),true)};
    validateMesh(transition.meshData,[{...transition,vertex_offset:0}]);
  }
  return {book:{...scene,worlds,transition},shaders:library.shaders};
}
