# Wonder (`barbet`) Agent Guidelines

## Naming & Code Style
- **No abbreviations in domain/API names:** Spell out enum members, store fields, function parameters, and shader attribute/varying names in full (e.g. `AnimationId`, `animationStartTick`, `previousDirection`, `positionXZ` — not `AnimId`, `animStartTick`, `prevDir`, `posXZ`).
- **Keep idiomatic short locals:** Standard short names are fine and preferred for typed-array views (`f32`, `u32`, `u16`, `u8`), vector/transform components (`x`, `y`, `z`, `sx`, `sy`, `sz`, `tx`, `ty`, `tz`, `nx`, `ny`, `nz`), and `impl` (`const impl = globals.createGpuResources(spec)`).
- **Avoid redundant indirection and state:**
  - Access `game.entities2`, `game.world`, and `elementOffsets.<attr>` directly instead of creating one-off local aliases or destructuring-with-renames (`const { entityId: offsetEntityId } = ...`).
  - Prefer `Math.min` / `Math.max` over manual comparison ternaries, and prefer clear composite getters (`const { x, z } = game.entities2.getPosition(entityId)!`) over split scalar calls when readability benefits.
- **Formatting:** Follow `barbet/.prettierrc.json` (no semicolons, single quotes, trailing commas, `printWidth: 120`, `arrowParens: 'avoid'`). Note that `barbet/tsconfig.json` targets TypeScript 5.7+ (`es2024`).

## ECS (`barbet/src/main/game-state/new-entities/`)
- **Shared vs. archetype-specific stores:** Only create a generic store (e.g. `position.ts`, `facing.ts`) when the exact representation is reusable across multiple `EntityKind` archetypes (such as slimes, units, and animals). Put archetype-specific state and enums in `<kind>-*.ts` stores (e.g. `slime-metadata.ts`, `slime-animation.ts`) with archetype-prefixed methods (`getSlime*` / `setSlime*`) so flat `mergeStores(...)` namespaces stay unambiguous.
- **Strict enum typing:** Type store read/write signatures with their specific TypeScript enum (`SlimeAnimationId`, `SlimeColorId`, `Direction`) rather than `number`, and always pass named enum members (e.g. `SlimeAnimationId.Idle`, `Direction.PositiveX`) instead of magic `0` literals in `onEntityAllocated` and callers.

## WebGL2 Rendering (`barbet/src/main/3d-stuff/`)
- **Derive strides and offsets from `layout`:** Never hardcode vertex or instance byte strides or manual typed-array offsets. Read `{ strideBytes, byteOffsets, elementOffsets }` from `impl.buffers.<bufferName>.layout` computed during `globals.createGpuResources(spec)`.
- **Keep `shaders.ts` declarative:** Declare buffer specs cleanly (`{ dynamic: true }` / `{ dynamic: false }`) with inline program `attributes` rather than importing entity max-count constants or computing `initialBytesCapacity` inside `shaders.ts`. For dynamic buffers rewritten from offset `0` each frame, prefer `setContent(...)` unless fixed-capacity `setSize(...)` + `setPartialContent(...)` is specifically needed for large instance counts.


