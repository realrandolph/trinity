import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);

test('renderer switches studio probes with inspection mode and refreshes the cached environment',async()=>{
  const renderer=await readFile(new URL('src/renderer.js',root),'utf8');
  assert.match(renderer,/u1\(p,'studio_environment',inspectionFixture\?1:0\)/);
  assert.match(renderer,/mirrorEnvironment\.draw\(pc,up,baseZ,atmosphere\.showEnergy,\{probe:true,studio:inspectionFixture/);
  assert.match(renderer,/mirrorEnvironment\.draw\(rc,reflectUp,baseZ,atmosphere\.showEnergy,\{studio:inspectionFixture\}\)/);
  assert.match(renderer,/cachedInspection!==inspectionFixture/);
});

test('release bundle contains the inspection environment mode',async()=>{
  const bundle=await readFile(new URL('dist/trinity-1.2.2.mjs',root),'utf8');
  assert.match(bundle,/studio_environment/);
  assert.match(bundle,/studio:Q/,'the minified renderer routes selected-asset inspection into studio probes');
});
