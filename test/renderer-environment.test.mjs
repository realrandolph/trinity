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
  const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  const bundle=await readFile(new URL(`dist/trinity-${pkg.version}.mjs`,root),'utf8');
  assert.match(bundle,/studio_environment/);
  assert.match(bundle,/studio:[a-zA-Z0-9_$]/,'the minified renderer routes selected-asset inspection into studio probes');
});
