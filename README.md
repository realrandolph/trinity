# Trinity

Trinity renders Ymir schema-2 Models and schema-3 Props with one WebGL2 pipeline.
Shared geometry loads independently from prop appearances.
See [FORMAT.md](FORMAT.md).

Interactive browser previews offer optional lower-cost settings (see
`ymir/CURRENT.md`). Video renders use full-quality defaults. Ymir's catalog lists
current shared resources, while each finished job pins its rendered bytes.

**Current version: 1.1.1.** The renderer interface uses shader ABI
`trinity-grwm-v2`.

Reusable WebGL2 renderer extracted from the GRWM v4 rendering pipeline. Ymir owns
the exact custom material shaders and prop meshes. Trinity
owns GPU resources, shadow/reflection passes, transparent surfaces, surface
glints, and frame submission. Synesthesia and project adapters provide audio
analysis and song interpretation.

## Use

```js
import {loadScene,createRenderer} from './vendor/trinity/trinity-1.1.1.mjs';

const {book, shaders} = await loadScene(new URL('./scene.json', import.meta.url));
const renderer = await createRenderer({canvas, book, shaders});
// Supply camera matrices, one local-to-world transform per node, and optionally
// light position/matrix, atmosphere and a transition mesh pose for each frame.
renderer.render({t, world: book.worlds[0], transforms, cam, projection});
renderer.dispose();
```

`transforms` entries have `model` (column-major mat4) and `art`, `perc`, `voice`,
`extra` (vec4 each). `cam` has `eye`, `target`, `view`. The bundle exports
Trinity's matrix helpers. The project adapter supplies complete frame state for
each requested timestamp. Optional atmosphere: `tint`, `keyGain`, `fill`, `fog`,
`glints`. See `FORMAT.md` for asset and scene contracts.

Synesthesia exposes a video adapter as `window.__synesthesia` with `renderAt(t)`
and `dispose()`. Project adapters own musical choreography and captions;
Synesthesia owns audio analysis.

## Project integrations

Finished videos keep independent `vendor/` snapshots. The current GRWM project
snapshot uses schema-1 Prop manifests and its pinned Trinity package. The staging
workflow targets schema-3 Props and validates the scene before updating
dependencies. Migrate those manifests before restaging the project.

## Tests

```sh
cd trinity
npm ci
npm test
npm run build
```

The browser runtime uses native Web APIs; `esbuild` is a build-time dependency.
`npm run build` emits one versioned ESM bundle and its SHA-256 manifest under the
ignored `dist/` directory. It bundles Trinity's JS modules; the project continues
to stage Ymir's shaders, effects and model/Color assets separately.

Publish a versioned GitHub Release (the repository is private):

```sh
gh release create v1.1.1 dist/trinity-1.1.1.mjs dist/SHA256SUMS \
  --repo realrandolph/trinity --title "Trinity 1.1.1"
```

`tools/stage.mjs` downloads the exact release artifact with `gh`, verifies its
published checksum, and updates the job runtime to import that bundle.
`dependencies.json` records the release tag and digest. Staging updates the local
snapshot explicitly; renders use the staged files. Stage projects after their
scenes use current schema-3 Ymir Props, migrating existing GRWM manifests first.

Unit tests cover bundle exports and import rewriting, the current loader contract,
and surface grouping.

## Compatibility and scope

Shader suites use `trinity-grwm-v2`. The renderer uses Ymir's authored shaders,
studio backdrop, shadows, reflections, transparency,
glints, particles, and bloom pipeline. Planar reflections select one mirror per
frame; transparent surfaces retain authored draw order.

`provenance-v4.json` records source hashes for extraction lineage. Asset ownership
and resale rights receive separate review. Each project-local `vendor/` snapshot
preserves its render dependencies. Update project adapters and Prop manifests to
the current format before staging a newer release.

## Documentation style

Describe behavior, ownership, supported formats, and workflows with direct,
affirmative statements. Express boundaries as responsibilities and requirements.
