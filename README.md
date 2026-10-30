# Trinity

Trinity is the single current WebGL2 renderer for Ymir's schema-2 Models and
schema-3 Props. Shared geometry is loaded independently of prop appearances.
See [FORMAT.md](FORMAT.md).

Interactive browser previews now use optional lower-cost settings (see
`ymir/CURRENT.md`). Video render defaults are unchanged. The shared Ymir library
no longer retains superseded entries; previously staged jobs remain self-contained.

**Current version: 1.0.0.** The renderer supports one shader ABI:
`trinity-grwm-v2`. There is no legacy renderer or ABI dispatcher.

Reusable WebGL2 renderer extracted from the GRWM v4 rendering pipeline. Ymir owns
the exact custom material shaders and prop meshes. Trinity
owns GPU resources, shadow/reflection passes, transparent surfaces, surface
glints, and frame submission. It does not analyze audio or interpret song events.

## Use

```js
import {loadScene} from './vendor/trinity/src/assets.js';
import {createRenderer} from './vendor/trinity/src/renderer.js';

const {book, shaders} = await loadScene(new URL('./scene.json', import.meta.url));
const renderer = await createRenderer({canvas, book, shaders});
// Supply camera matrices, one local-to-world transform per node, and optionally
// light position/matrix, atmosphere and a transition mesh pose for each frame.
renderer.render({t, world: book.worlds[0], transforms, cam, projection});
renderer.dispose();
```

`transforms` entries have `model` (column-major mat4) and `art`, `perc`, `voice`,
`extra` (vec4 each). `cam` has `eye`, `target`, `view`. `src/math.js` supplies
matrix helpers. All state must be established from the requested timestamp.
Optional atmosphere: `tint`, `keyGain`, `fill`, `fog`, `glints`. No accumulated
simulation is run by Trinity. See `FORMAT.md` for asset and scene contracts.

Synesthesia remains unchanged: a video project exposes its adapter as
`window.__synesthesia` with `renderAt(t)` and `dispose()`. Do not put musical
choreography or captions into this renderer. The analyzer remains in Synesthesia.

## Project integrations

Finished videos keep independent `vendor/` snapshots. The current GRWM project
snapshot still has schema-1 Prop manifests and its own previous Trinity copy; it
is intentionally untouched. `tools/stage.mjs` replaces vendor dependencies only
after validating that the scene uses current schema-3 Props and refuses to stage
older manifests. Migrate the project adapter/assets before explicitly restaging.

## Tests

```sh
cd trinity
npm test
```

The renderer itself has **no npm dependencies**. Unit tests validate the current
Ymir catalog, every referenced model mesh, and shader-suite assignments. They do
not capture screenshots or certify artistic quality.

## Compatibility and scope

Only `trinity-grwm-v2` shader suites are accepted. No PBR fallback exists. The
renderer retains the authored studio backdrop, shadows, reflections, transparency,
glints, particles, and bloom pipeline. Planar reflections select one mirror per
frame; transparent surfaces retain authored draw order.

`provenance-v4.json` records extraction source hashes, not ownership or resale
rights. Older project-local `vendor/` snapshots are self-contained and are not
rewritten by this repository cleanup. A project using the former renderer ABI or
old prop manifests must be migrated before it can be explicitly restaged.
