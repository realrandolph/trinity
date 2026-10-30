import test from 'node:test';
import assert from 'node:assert/strict';
import {pointAtTrinityRelease} from '../tools/stage-imports.mjs';

test('staging consolidates source imports into the pinned single-file release',()=>{
  const source=[
    "import {createRenderer} from './vendor/trinity/src/renderer.js';",
    "import {loadScene,resolveColor} from './vendor/trinity/src/assets.js';",
    "import {multiply} from './vendor/trinity/src/math.js';",
    'const renderer=createRenderer;'
  ].join('\n');
  const result=pointAtTrinityRelease(source,'trinity-1.1.0.mjs');
  assert.equal((result.match(/from '\.\/vendor\/trinity\/trinity-1\.1\.0\.mjs'/g)??[]).length,1);
  assert.match(result,/\{createRenderer,loadScene,resolveColor,multiply\}/);
  assert.doesNotMatch(result,/vendor\/trinity\/src\//);
});

test('already-pinned imports remain unchanged and unsupported import forms fail',()=>{
  const pinned="import {loadScene} from './vendor/trinity/trinity-1.1.0.mjs';";
  assert.equal(pointAtTrinityRelease(pinned,'trinity-1.1.0.mjs'),pinned);
  assert.throws(()=>pointAtTrinityRelease("import * as Trinity from './vendor/trinity/src/index.js';",'trinity-1.1.0.mjs'),/named imports only/);
});
