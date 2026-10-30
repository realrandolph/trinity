// Stage a dependency snapshot inside a Synesthesia job's permitted serving root.
import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const destination=path.resolve(root,process.argv[2]??'projects/grwm/video/v4/trinity-integration');
if(!destination.startsWith(root+path.sep))throw new Error('Destination must stay within the music workspace');
const scene=JSON.parse(await readFile(path.join(destination,'scene.json'),'utf8'));
const catalog=JSON.parse(await readFile(path.join(root,'ymir/catalog.json'),'utf8'));
const suite=JSON.parse(await readFile(path.join(root,'ymir',catalog.defaultSuite),'utf8'));
if(scene.rendererABI!==suite.rendererABI)throw new Error('Current Ymir suite uses a different renderer ABI. Keep this job pinned or explicitly upgrade its adapter before restaging.');
if(scene.rendererABI!=='trinity-grwm-v2')throw new Error('Trinity stages only the current trinity-grwm-v2 renderer ABI.');
const outdated=[];
for(const world of scene.worlds)for(const instance of world.instances){
  const file=path.resolve(destination,scene.assetBase,instance.asset);
  if(file!==root&&!file.startsWith(root+path.sep))throw new Error('Scene Prop manifests must stay inside the music workspace');
  const asset=JSON.parse(await readFile(file,'utf8'));
  if(asset.type!=='prop'||asset.schemaVersion!==3)outdated.push(`${instance.asset} (schema ${asset.schemaVersion})`);
}
if(outdated.length)throw new Error(`Cannot restage outdated Prop manifests; migrate these instances to current Ymir Prop schema 3 first:\n${outdated.join('\n')}`);
scene.shaderSuite=catalog.defaultSuite;
const vendor=path.join(destination,'vendor');await mkdir(vendor,{recursive:true});
const trinity=path.join(vendor,'trinity/src'),library=path.join(vendor,'ymir');
await rm(trinity,{recursive:true,force:true});await rm(library,{recursive:true,force:true});
await cp(path.join(root,'trinity/src'),trinity,{recursive:true});
await mkdir(library,{recursive:true});
for(const part of ['catalog.json','models','props','colors','effects','provenance-v4.json'])
  await cp(path.join(root,'ymir',part),path.join(library,part),{recursive:true});
await cp(path.join(root,'ymir/materials/ymir-surfaces-v1'),path.join(library,'materials/ymir-surfaces-v1'),{recursive:true});
await cp(path.join(root,'ymir/materials/surfaces'),path.join(library,'materials/surfaces'),{recursive:true});
scene.assetBase='./vendor/ymir/';await writeFile(path.join(destination,'scene.json'),JSON.stringify(scene,null,2)+'\n');
const hashes={};
async function inventory(folder){
  for(const entry of await readdir(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name);
    if(entry.isDirectory())await inventory(file);
    else if(entry.isFile())hashes[path.relative(destination,file)]=createHash('sha256').update(await readFile(file)).digest('hex');
  }
}
await inventory(path.join(destination,'vendor'));
await writeFile(path.join(destination,'dependencies.json'),JSON.stringify({
  trinity:JSON.parse(await readFile(path.join(root,'trinity/package.json'))).version,
  ymir:JSON.parse(await readFile(path.join(root,'ymir/package.json'))).version,
  provenance:JSON.parse(await readFile(path.join(root,'trinity/provenance.json'))),
  files:hashes,
  note:'Self-contained dependency snapshot. Restaging is explicit, never automatic during rendering.'
},null,2)+'\n');
console.log('Staged Trinity/Ymir into',destination);
