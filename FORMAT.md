# House format

## Surface slots and named Colors (prop schema 3)

Models (schema 2) now define `slots: [{id,name,partIds}]`; each model part has
`name` and `slotId`. A slot contains no material or color assignment.
Props (schema 3) own `slots: [{slotId,material:{id,parameters?},color?:{id}}]`.
Material parameters contain surface controls only, never `color`. Every current
Material references a named `defaultColorId`. A slot's optional Color reference
overrides that default; otherwise it follows the Material's named default Color.
Variants inherit defaults and specify sparse `slots` overrides. `partMetadata`
preserves original labels/glint metadata without geometry or material bindings.

Color resources are named schema-1 catalog records with `parameters` describing a
generator, primary/secondary palette values, scale and offset. Pattern resources
also reference named solid Colors via `palette: {primary,secondary}`. These named
inputs are resolved on load. The GPU receives resolved palette data, independently
of the material profile. Palette literals are only stored in Color definitions,
not in surface assignments or Material resources.

The current `ymir-surfaces@1` suite loads `colorGenerators` as a separate GLSL source.
It retains custom surface shading and geometric relief (including grain, weave,
fibres and associated surface shading), while genuine pigment patterns alone
are independently selectable Color generators. The renderer accepts only the
`trinity-grwm-v2` ABI, including Color and selection uniforms.

See `ymir/COLORS-AND-SLOTS.md` for authoring, migration and mapping limitations.

## Model / Prop / Variant

The catalog uses schema 1 for indexing, Models schema 2, and Props schema 3.
Trinity loads only this current Model/Prop format.

- **Model**: `models/<fingerprint>/model.json`, owns `mesh`, `meshSha256`, bounds,
  and `parts` with stable IDs, byte offsets/counts, and default assembly transforms
  (and joints where applicable). No materials, colors or appearance bindings.
- **Prop**: references `modelId` and workspace-library-relative `model` manifest;
  owns `parts` referring to model part IDs, placement/pose overrides, deformation,
  labels and surface metadata. No mesh file or vertex/index data.
- **Variant**: a named `variants` entry on the prop, with sparse `slots` overrides
  and `partMetadata`. Props select an explicit `defaultVariant`.

`loadProp(manifest,{variant})` resolves these resources into the renderer's normal
editable node data. `loadModel(manifest)` previews the independently assembled
geometry with a neutral configuration of the existing custom shader. Model
resources and verified mesh buffers are cached independently of prop/variant
selection. Scenes may set `instance.variant`.

Model sharing is exact vertex/index-buffer equality, preserving normals, UVs and
part multiplicity. Scale and pose remain explicit prop data. It does not assert
that visually similar or differently tessellated shapes are interchangeable.

Deletion is non-cascading: variants leave their prop/model intact; props leave
their shared model intact; models cannot be deleted while referenced by any prop.
This policy is enforced server-side as well as explained in the browser dialog.

Preview-only quality options can set `shadowSize`, `cacheEnvironment`, and
`synchronize`; their defaults preserve the full video pipeline. Environment
caching assumes immutable world/transform/lighting objects and invalidates when
their references or `originZ` change. Do not enable it for in-place animated data.

The authoritative asset format is custom, not GLB/glTF. Shaders are retained,
not approximated by PBR. All URLs in manifests are relative; browser loaders
reject unknown format/ABI versions and missing material IDs.

## Geometry

Little-endian, tightly packed float32 vertices: position XYZ, normal XYZ, UV
(32 bytes/vertex). Triangle indices are uint32, local to a node's vertices.
Each node specifies byte offsets and element counts into its asset's `mesh.bin`.
Local transforms use XYZ Euler degrees and XYZ scales, Y-up coordinates.
Bounds are assembly-local min/max XYZ. Nodes retain joints, deformation amount,
surface metadata and optional metal-surface glint anchors.

Models own mesh data and stable part/slot definitions; Props refer to model parts
and store placement, surface assignments and variants. Scene placement and song
data remain outside the reusable asset manifests.

## Materials

Named versioned Material IDs map to profiles in the current shader suite. The suite
defines vertex, fragment, depth, effect sources, and the single supported renderer
ABI. The profile integer is an implementation detail; Material and Color IDs are
the external resource identities.

Adding a profile requires a suite revision and implementation in the current
renderer. Never reuse an ID when changing an asset's appearance.

## Scenes

`scene.json`: `schemaVersion: 1`, `rendererABI`, `assetBase`, `shaderSuite`,
`duration`, `worlds`, `transition`, and optional project-authored camera metadata.
Each world contains `instances`: an asset manifest reference, its scene `rig`
(placement, scale, bounds, role, event bindings) and per-node `nodeOverrides`
(original ordering identity, assembly ID, scene tag/bindings). Rig IDs are
consecutive within a world. `loadScene` resolves material IDs and reconstructs
editable node data for rendering; it validates mesh ranges, finite vertices,
triangle indices, and prop checksums. Scene adapters evaluate all music/animation
state; the renderer consumes matrices rather than knowing track names.

## Versioning

Stable names identify assets; explicit versions identify appearances. Staged
project dependencies pin actual asset/shader bytes, not just "latest" names.
Source hashes provide extraction provenance, **not ownership or resale rights**.
