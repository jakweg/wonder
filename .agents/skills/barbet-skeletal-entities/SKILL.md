---
name: barbet-skeletal-entities
description: >-
  Architecture and runbook for adding declarative GPU skeletal animations or
  new rigged 3D entities (Steve clips, animals like Cow/Sheep, headless entities
  like Boats) in barbet/. Use whenever working on @3d/skeletal/, entity meshes,
  animation clips, entity shaders, skeletal-animation.ts, or head-look.ts.
---

# `barbet` Declarative GPU Skeletal Entities & Animations

Rigged entities in `barbet/` evaluate animations on the GPU from a single shared `RGBA16F` `SkeletalPoseAtlas` (`TextureSlot.SkeletalPoseAtlas`, uploaded once in `makeShaderGlobals`) so entities remain **CPU-asleep** (`wakeTick` in the future) throughout multi-tick actions and strides.

## Key Modules

- **ECS Stores (`barbet/src/main/game-state/new-entities/stores/` — worker-shared, zero `@3d` imports):**
  - `skeletal-animation.ts`: Generic clip playback + outgoing freeze-frame cross-fade (`animationId`, `previousAnimationId`, `previousAnimationFrame`, `animationStartTick`).
  - `head-look.ts`: Independent 2-axis head yaw/pitch interpolation (`setHeadLook`, `resetHeadLook`). Compose onto entities with heads (Steve, Cow, Sheep); **omit** on headless entities (Boats).
  - `facing.ts`: 8-way facing with independent `facingStartTick` (`setFacing(entityId, direction, game.currentTick)`).
  - `<entity>-animation-id.2bc.json`: Single source of truth for `<Entity>AnimationId`, `duration-ticks`, and `loop` so 3D keyframe tracks never enter `update-worker.js`.
- **GPU Skeletal Framework (`barbet/src/main/3d-stuff/skeletal/` — render-worker only):**
  - `skeleton.ts`: `defineSkeleton` (topological bone hierarchy + static cuboids) and `resolveBoneIndex`.
  - `clip.ts`: `defineAnimationClip`, `oscillateBoneTrack`, `mirrorClipLeftRight`, `deg`, `KeyframeEasing`.
  - `pose-atlas.ts`: `registerClipRecord` (`64` frames/clip; Row `0` = `vec4(localRootOffset.xyz, verticalBlocksOffset)`, Rows `1..boneCount` = hemisphere-aligned unit quaternions) and `uploadSharedSkeletalPoseAtlas`.
  - `glsl-rig.ts`: Branch-free ancestor-chain quaternion FK + `nlerp` cross-fade using core WebGL2 `textureLod` and `textureSize`.
  - `shader.ts`: `createSkeletalShaderSpec`, `paletteToGlsl`, `declareGlslPalette`.
  - `element.ts`: `createSkeletalEntityElement`.
- **Reference Entity:** `barbet/src/main/3d-stuff/elements/steve/` (`mesh.ts`, `animations/`, `shaders.ts`, `steve.ts`).

## Workflow A: Adding a New Animation to an Existing Entity (e.g. Steve)

1. **Add enum & timing in `<entity>-animation-id.2bc.json`:**
   Add the new member with `"duration-ticks"` and `"loop"`, then compile `.2bc.json` (see `barbet-build-and-verify`).
2. **Author the clip in `@3d/elements/<entity>/animations/`:**
   - Use `defineAnimationClip<EntityBoneName>({ blendInTicks, stepMovement, ambientWeight, rootOffset, tracks, evaluate })`.
   - Use `oscillateBoneTrack` for repeated swings (waving, chopping, harvesting, rowing) and `mirrorClipLeftRight(rightClip, MIRROR_BONES)` for left/right symmetry.
   - Register in `animations/index.ts`: `registerClipRecord` checks exhaustiveness against `<Entity>AnimationId.SIZE` at compile time.
3. **Trigger from CPU activity (`game-state/new-entities/activities/<entity>/`):**
   - Call `game.entities2.setSkeletalAnimation(self, <Entity>AnimationId.NewClip, game.currentTick)` (and `game.entities2.resetHeadLook(self, game.currentTick)` if idle head glances should recenter).
   - Sleep on CPU for the clip duration: `(game.currentTick + get<Entity>AnimationDuration(id)) >>> 0`.

## Workflow B: Creating a New Skeletal Entity (Animal, Boat, etc.)

1. **ECS & `.2bc.json` setup:**
   - Create `stores/<entity>-animation-id.2bc.json` (`add-size: true`, `duration-ticks`, `loop` getters; clip `0` is the default idle clip).
   - Register the new `EntityKind` in `kind.2bc.json` with `generation`, `position`, `facing`, `skeletal-animation`, optional `head-look`, `interruptions`, `activity`, and any `<entity>-metadata` store.
   - Add `case EntityKind.<Entity>:` to `getSkeletalAnimationDuration` and `isSkeletalAnimationLooping` in `stores/skeletal-animation.ts`.
2. **Skeleton & Mesh (`@3d/elements/<entity>/mesh.ts`):**
   - Declare bones in `defineSkeleton({ ... })` with **parents listed before children**.
   - Reference parents with mangle-safe `BoneRef` objects (`parent: { Hull: true }`), **never** string literals (`parent: 'Hull'`).
   - `paletteSlot` on each cube is an integer material/palette slot resolved per-instance in GLSL (overlap joints by ~`0.5–0.8` model pixels so pitching/bending never opens seam gaps).
3. **Clips (`@3d/elements/<entity>/animations/index.ts`):**
   - Call `registerClipRecord(skeleton, <Entity>AnimationId.SIZE, { ... }, getDuration, isLooping)`.
4. **Shader (`@3d/elements/<entity>/shaders.ts`):**
   - Build with `createSkeletalShaderSpec({ skeleton, poseAtlasAllocation, headLook, extraInstanceAttributes, utilDeclarations, ...hooks, resolveFragmentColor })`.
   - Pass `headLook: { headBone: { Head: true } }` only if the entity uses `head-look.ts`.
   - Set `passToFragment: true` on any `extraInstanceAttributes` entry needed inside `resolveFragmentColor` (avoids manual varyings).
   - Hooks receive **only** `attrs` (mangle-safe attribute names, internally prefixed with `extraAttr_` / `extraVarying_` to prevent collisions) and read GLSL `SkeletalContext ctx` (`ctx.boneId`, `ctx.paletteSlot`, `ctx.entityId`, `ctx.phaseSeed`, `ctx.ambientWeight`, `ctx.currentHeadAngles`, `ctx.targetHeadAngles`), `model`, `normal`, `boneIndex`, `boneQuat`, `paletteSlot`, and `entityId` directly.
5. **Pipeline Element (`@3d/elements/<entity>/<entity>.ts` & `elements/index.ts`):**
   - Export `createSkeletalEntityElement({ kind: EntityKind.<Entity>, shader, writeExtraInstanceAttributes })` and add it to `createElements` in `@3d/elements/index.ts` (do **not** re-upload `getSharedSkeletalPoseAtlas()` inside the element — `makeShaderGlobals` uploads it once centrally).

## WebGL2 & Layout Notes

- **Current Pose Atlas channels:** Bone tracks currently bake pivot rotations (`pitch`, `yaw`, `roll` -> 1 quaternion row per bone) plus clip-level `rootOffset` (`1 + boneCount` rows per clip); per-bone `offset` and `scale` channels are not yet supported.
- **Portable WebGL2 limits & zero-gap layout:** Chrome/ANGLE enforces `MAX_VERTEX_ATTRIBS = 16`. Keep total vertex + instance attribute count `<= 16` by packing related scalars into `uvec2`/`uvec3`/`uvec4`, and preserve `4B -> 2B -> 1B` component-size ordering so interleaved strides have zero alignment gaps.
- **Core WebGL 2.0 (`#version 300 es`) only:** Rely only on standard ES 3.0 features (`RGBA16F` + `RGBA` + `FLOAT` with `LINEAR` filtering, `textureLod(..., 0.0)`, `textureSize(..., 0)`). Never assume optional extensions without a fallback.
