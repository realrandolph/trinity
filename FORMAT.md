# House format

## Surface slots and named Colors (prop schema 3)

Models (schema 2) define `slots: [{id,name,partIds}]`; each model part has
`name` and `slotId`. Models describe geometry and group parts into named slots.
Props (schema 3) own `slots: [{slotId,material:{id,parameters?},color?:{id}}]`.
Material parameters describe surface response. Every current Material references
a named `defaultColorId`; a slot's optional Color reference overrides that default.
Variants inherit defaults and specify sparse `slots` overrides. `partMetadata`
stores part labels and glint metadata alongside those overrides.

Color resources are named schema-1 catalog records with `parameters` describing a
generator, primary/secondary palette values, scale and offset. Pattern resources
also reference named solid Colors via `palette: {primary,secondary}`. These named
inputs are resolved on load. The GPU receives palette data independently of the
material profile. Color definitions own palette literals; assignments reference
named Color resources.

The current `ymir-surfaces@1` suite loads `colorGenerators` as a separate GLSL source.
It retains custom surface shading and geometric relief (including grain, weave,
fibres and associated surface shading). Pigment patterns are selectable Color
generators. The renderer uses ABI `trinity-grwm-v2`, including Color and selection
uniforms.

See `ymir/COLORS-AND-SLOTS.md` for authoring, migration and mapping limitations.

## Model / Prop / Variant

The catalog uses schema 1 for indexing, Models schema 2, and Props schema 3.
Trinity loads these current Model and Prop formats.

- **Model**: `models/<fingerprint>/model.json`, owns `mesh`, `meshSha256`, bounds,
  and `parts` with stable IDs, byte offsets/counts, and default assembly transforms
  (and joints where applicable). Props and Variants reference its geometry.
- **Prop**: references `modelId` and workspace-library-relative `model` manifest;
  owns `parts` referring to model part IDs, placement/pose overrides, deformation,
  labels and surface metadata; mesh data remains owned by the Model.
- **Variant**: a named `variants` entry on the prop, with sparse `slots` overrides
  and `partMetadata`. Props select an explicit `defaultVariant`.

`loadProp(manifest,{variant})` resolves these resources into the renderer's normal
editable node data. `loadModel(manifest)` previews the independently assembled
geometry with a neutral configuration of the existing custom shader. Model
resources and verified mesh buffers are cached independently of prop/variant
selection. Scenes may set `instance.variant`.

Model sharing uses exact vertex/index-buffer equality, preserving normals, UVs and
part multiplicity. Scale and pose remain explicit Prop data. Geometry with
different tessellation remains in a distinct Model.

Deleting a Variant retains its Prop and Model. Deleting a Prop retains its shared
Model. The editor protects Models while Props reference them and explains this in
the browser dialog.

Preview-only quality options can set `shadowSize`, `cacheEnvironment`, and
`synchronize`; their defaults preserve the full video pipeline. Environment
caching assumes immutable world/transform/lighting objects and invalidates when
their references or `originZ` change. Use immutable frame data with this option.

Trinity uses Ymir's custom asset format and authored shader sources. Manifest URLs
are relative. Browser loaders validate supported format/ABI versions and resolve
all referenced Material IDs.

## Geometry

Little-endian, tightly packed float32 vertices: position XYZ, normal XYZ, UV
(32 bytes/vertex). Triangle indices are uint32, local to a node's vertices.
Each node specifies byte offsets and element counts into its asset's `mesh.bin`.
Local transforms use XYZ Euler degrees and XYZ scales, Y-up coordinates.
Bounds are assembly-local min/max XYZ. Nodes retain joints, deformation amount,
surface metadata and optional metal-surface glint anchors.

Models own mesh data and stable part/slot definitions. Props refer to model parts
and own placement, surface assignments and Variants. Scene placement and song data
belong to project adapters.

## Materials

Named versioned Material IDs map to profiles in the current shader suite. The suite
defines vertex, fragment, depth, effect sources, and the single supported renderer
ABI. The profile integer is an implementation detail; Material and Color IDs are
the external resource identities.

Adding a profile requires a suite revision and implementation in the current
renderer. Assign a new ID to each distinct appearance version.

## Scenes

`scene.json`: `schemaVersion: 1`, `rendererABI`, `assetBase`, `shaderSuite`,
`durationSeconds`, `worlds`, and optional camera/animation data. Each world holds
`instances` referencing Prop manifests and rig transforms. Per-node `nodeOverrides`
add authored scene metadata when needed; rig transforms and generated identities
provide defaults. Rig IDs are consecutive within a world. `loadScene` resolves
Material IDs, assembles editable node data, and validates mesh ranges, finite
vertices, triangle indices, and Prop checksums. Transition geometry is an optional
scene asset. Synesthesia evaluates scene keyframes and audio bindings into matrices.

## Versioning

Stable names identify assets; explicit versions identify appearances. Staged
project dependencies pin exact asset and shader bytes for reproducible rendering.
Source hashes document extraction provenance. Ownership and resale rights receive
separate review.
