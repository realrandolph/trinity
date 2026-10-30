import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {loadLibrary,loadScene,validateMesh} from '../src/assets.js';
import {createRenderer} from '../src/renderer.js';

test('loader resolves current Ymir manifests and rejects obsolete formats',async()=>{
  const base='https://fixture.test/ymir/';
  const mesh=new ArrayBuffer(108),vertices=new Float32Array(mesh,0,24);
  vertices.set([0,0,0,0,0,1,0,0, 1,0,0,0,0,1,1,0, 0,1,0,0,0,1,0,1]);
  new Uint32Array(mesh,96,3).set([0,1,2]);
  const meshBytes=new Uint8Array(mesh),sha=createHash('sha256').update(meshBytes).digest('hex');
  const model={type:'model',schemaVersion:2,id:'ymir/model@test',mesh:'mesh.bin',meshSha256:sha,bounds:[[0,0,0],[1,1,0]],parts:[{id:'part',name:'Part',slotId:'surface',vertex_offset:0,index_offset:96,vertex_count:3,index_count:3,pos:[0,0,0],rot:[0,0,0],scale:[1,1,1],assembly:0}]};
  const prop={type:'prop',schemaVersion:3,id:'ymir/prop@test',modelId:model.id,model:'models/test/model.json',parts:[{partId:'part',pos:[0,0,0],rot:[0,0,0],scale:[1,1,1]}],slots:[{slotId:'surface',material:{id:'ymir/matte@test'},color:{id:'ymir/blue@test'}}],defaultVariant:'base',variants:[{id:'base',name:'Base',slots:[],partMetadata:[]}]};
  const suite={id:'ymir-surfaces@1',rendererABI:'trinity-grwm-v2',vertex:'main.vert',fragment:'main.frag',depth:'depth.frag',profiles:['ymir/matte@test']};
  const catalog={schemaVersion:1,defaultSuite:'materials/current/suite.json',assets:[
    {id:'ymir/matte@test',type:'material',suite:suite.id,profile:0,parameters:{rough:.8,metal:0},defaultColorId:'ymir/blue@test'},
    {id:'ymir/blue@test',type:'color',parameters:{primary:[.1,.2,.3],secondary:[.1,.2,.3],pattern:-1,scale:[1,1],offset:[0,0]}},
  ]};
  const files=new Map([
    ['catalog.json',catalog],['materials/current/suite.json',suite],['materials/current/main.vert','vertex'],
    ['materials/current/main.frag','fragment'],['materials/current/depth.frag','depth'],
    ['props/test/prop.json',prop],['models/test/model.json',model],['models/test/mesh.bin',meshBytes],
    ['props/test/old.json',{type:'prop',schemaVersion:1}],
    ['scene-old.json',{schemaVersion:1,rendererABI:'unsupported-abi'}],
  ]);
  const oldFetch=globalThis.fetch,oldLocation=globalThis.location,oldCrypto=globalThis.crypto;
  Object.defineProperty(globalThis,'location',{value:{href:base},configurable:true});
  globalThis.fetch=async input=>{
    const key=new URL(input).pathname.replace('/ymir/','');const value=files.get(key);
    return {ok:value!==undefined,status:value===undefined?404:200,
      json:async()=>value,text:async()=>value,
      arrayBuffer:async()=>value instanceof Uint8Array?value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength):value};
  };
  Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
  try{
    const library=await loadLibrary(base),loaded=await library.loadProp('props/test/prop.json');
    assert.equal(loaded.nodes.length,1);assert.equal(loaded.nodes[0].kind,0);
    assert.deepEqual(loaded.nodes[0].color,[.1,.2,.3]);assert.equal(loaded.nodes[0].surfaceSlot,'surface');
    await assert.rejects(library.loadProp('props/test/old.json'),/requires Ymir prop schema 3/);
    await assert.rejects(loadScene(new URL('scene-old.json',base)),/trinity-grwm-v2/);
    suite.rendererABI='unsupported-abi';
    await assert.rejects(loadLibrary(base),/Unsupported shader ABI/);
  }finally{
    globalThis.fetch=oldFetch;
    if(oldLocation===undefined)delete globalThis.location;else Object.defineProperty(globalThis,'location',{value:oldLocation,configurable:true});
    if(oldCrypto===undefined)delete globalThis.crypto;else Object.defineProperty(globalThis,'crypto',{value:oldCrypto,configurable:true});
  }
});

test('invalid mesh ranges, indices and vertices fail early',()=>{
  const raw=new ArrayBuffer(108),n={vertex_offset:0,vertex_count:3,index_offset:96,index_count:3};
  validateMesh(raw,[n]);
  assert.throws(()=>validateMesh(raw,[{...n,index_offset:100}]),/range/);
  new Uint32Array(raw,96)[0]=3;assert.throws(()=>validateMesh(raw,[n]),/Index/);
  new Uint32Array(raw,96)[0]=0;new Float32Array(raw)[0]=NaN;assert.throws(()=>validateMesh(raw,[n]),/finite/);
});

test('renderer entry point refuses all but the current ABI',async()=>{
  await assert.rejects(createRenderer({canvas:{width:1,height:1},shaders:{rendererABI:'unsupported-abi'}}),/requires shader ABI trinity-grwm-v2/);
});
