---
name: barbet-render-sync
description: >-
  Architecture and invariants for mutex-budgeted true vs. extrapolated (fake)
  frame synchronization, StateUpdater tick estimation, lock-free terrain/camera
  snapshots, and shader end-tick clamping in barbet/. Use whenever editing
  new-render-context.ts, game-mutex.ts, state-updater/, world-terrain-snapshot.ts,
  pipeline elements' updateWorldSync/uploadToGpu, or entity animation timing.
---

# `barbet` Render Sync & Tick Estimation Architecture

## 1. True vs. Extrapolated (Fake) Frame Loop (`new-render-context.ts`)

- **Same tick (`Math.floor(gameTickValue) <= lastTrueRenderedTick`)**: Skip `GameMutex` and `updateWorldSync()`; update camera/visibility from `terrainSnapshot`, refresh `Globals` UBO (`u_gameTick`), and draw existing GPU buffers.
- **New tick due (`intEstimation > lastTrueRenderedTick`, including initial `-1`)**:
  - Try `mutex.tryEnterForRender(timeoutMs)` / `tryEnterForRenderAsync(timeoutMs)` with quadratic backoff `consecutiveMutexTimeouts ** 2 * 2 + 1` ms (`1ms, 3ms, 9ms, 19ms, ...`).
  - **Contended timeout**: Increment `consecutiveMutexTimeouts` and render an extrapolated frame without touching `decodedGame`.
  - **Acquired with `decodedGame.currentTick === lastTrueRenderedTick` (late timer)**: Reset `consecutiveMutexTimeouts = 0`, call `mutex.exitRender()` immediately so `update-worker` can acquire the lock, and fall back to an extrapolated frame.
  - **Acquired with new tick**: Update `lastTrueRenderedTick = currentTick`, reset `consecutiveMutexTimeouts = 0`, sync `terrainSnapshot` + `updateWorldSync()` inside `try..finally { mutex.exitRender() }`.

## 2. Zero Shared-Memory Reads Outside `GameMutex`

- **Never** read `decodedGame` (`metaData`, `world`, `entities2`) outside `GameMutex` or in `uploadToGpu()` / `updateCamera()`.
- `WorldTerrainSnapshot` (`world-terrain-snapshot.ts`) copies `rawHeightData` and `rawBlockData` inside `GameMutex` only when `MetadataField.LastWorldChange` advances. Camera clamping/raycasting (`mouse-interpreter.ts`) and `terrain.ts` `uploadToGpu()` read only `terrainSnapshot`.
- Gate instance buffer `setContent(...)` uploads in `skeletal/element.ts` and `slime/slime.ts` with `instancesDirty` so skipped/extrapolated frames perform zero redundant `bufferData` uploads. (Async chunk meshes in `chunksThatNeedUpload` from `RenderHelperWorkScheduler` still upload on any frame.)

## 3. `StateUpdater` Timing & Live TPS Changes (`state-updater/`)

- **Shared epoch**: Both `implementation.ts` and `controller.ts` use `getSharedWallClockMs()` (`performance.timeOrigin + performance.now()`) so cross-worker `startupTimeDifference` is not needed.
- **Seqlock (`ScheduleVersion`)**: `publishScheduleSnapshot` writes `Float64` `(RunStartTickLow/High, RunStartTimeLow/High)` and `TicksPerSecond` between odd/even `ScheduleVersion` stores inside `try..finally`; `estimateCurrentGameTickTime` spin-reads until even and unchanged.
- **Phase-continuous TPS & immediate wakeup**: `implementation.ts` waits via `waitAsyncCompat` on `BufferField.WakeCounter` woken by `Atomics.notify` in `start()`, `changeTickRate()`, `stop()`, and `terminate()`. On TPS change, it preserves exact fractional tick phase rather than jumping to an integer tick, and `controller.ts` adopts re-anchored `ScheduleVersion` snapshots immediately if `lastEstimatedTick >= executedTicks + 1` so lowering TPS never freezes `u_gameTick` or triggers `lateInterval` storms.

## 4. End-Tick Animation Clamping

- Step-movement clips (`SteveAnimationId.Walk`, `WalkUp`, `WalkDown`) have `"loop": false` and clamp `progress` to `[0.0, 1.0]` in `glsl-rig.ts` (`evaluateClipTiming`) so `worldStepOffset` settles at `vec3(0.0)` on extrapolated frames past `startTick + duration`.
- `SkeletalAnimationStore.setSkeletalAnimation` skips freeze-frame cross-fade (`SKELETAL_NO_PREVIOUS_FRAME`) for completed consecutive non-looping steps (`outgoingId === animationId && (outgoingLoops || elapsedTicks >= duration)`), while still cross-fading mid-step interruptions.
