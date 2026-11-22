import { Camera } from '@3d/camera'
import ChunkVisibilityIndex from '@3d/chunk-visibility'
import { createElements } from '@3d/elements'
import { makeShaderGlobals, ShaderGlobals } from '@3d/global-gpu-resources'
import RenderHelperWorkScheduler, { newHelperScheduler } from '@3d/pipeline/work-scheduler'
import { newAnimationFrameCaller, newContextWrapper, newFramesLimiter } from '@3d/pipeline/wrappers'
import { createWorldTerrainSnapshot, WorldTerrainSnapshot } from '@3d/world-terrain-snapshot'
import { createGameStateForRenderer, GameState } from '@game'
import { PASS } from '@game/game-state-piece'
import { createStateUpdaterControllerFromReceived, STANDARD_GAME_TICK_RATE } from '@game/state-updater'
import { gameMutexFrom, isInWorker } from '@utils/game-mutex'
import CONFIG from '@utils/persistence/observable-settings'
import { DrawPhase } from '@utils/worker/debug-stats/draw-phase'
import { FramesMeter } from '@utils/worker/debug-stats/frames-meter'
import { RenderDebugDataCollector } from '@utils/worker/debug-stats/render'
import TimeMeter from '@utils/worker/debug-stats/time-meter'
import { UICanvas } from 'src/main/ui/canvas-background'

const FRAMES_COUNT_RENDERING = 240

export type RenderingSessionStartArgs = {
  passedMutex: Parameters<typeof gameMutexFrom>[0]
  passedGame: unknown
  updater: unknown
  cameraBuffer: SharedArrayBuffer
  canvas: UICanvas
}

interface NewRenderingPipeline {
  readonly gl: WebGL2RenderingContext
  readonly visibility: ChunkVisibilityIndex
  readonly terrainSnapshot: WorldTerrainSnapshot
}

interface NewRenderingPipelineElement {
  /** Called inside `GameMutex` only when a new simulation tick is synced from `game` state. */
  updateWorldSync(): void
  uploadToGpu(): void
  draw(): void
}

interface NewRenderingPipelineElementCreatorArgs {
  pipeline: NewRenderingPipeline
  game: GameState
  globals: ShaderGlobals
  scheduler: RenderHelperWorkScheduler
}

export type NewRenderingPipelineElementCreator = (
  args: NewRenderingPipelineElementCreatorArgs,
) => NewRenderingPipelineElement

export const createRenderingSession = async (args: RenderingSessionStartArgs) => {
  const stats = new RenderDebugDataCollector(new FramesMeter(FRAMES_COUNT_RENDERING))
  const timeMeter = new TimeMeter<DrawPhase>(DrawPhase.SIZE)
  timeMeter.setEnabled(true)
  const mutex = gameMutexFrom(args.passedMutex)
  const decodedGame = createGameStateForRenderer(args.passedGame)
  const worldSizeLevel = decodedGame.world.sizeLevel
  const decodedUpdater = createStateUpdaterControllerFromReceived(args.updater)
  const gameTickEstimation = () => decodedUpdater.estimateCurrentGameTickTime()
  const scheduler = await newHelperScheduler(mutex)
  const visibility = ChunkVisibilityIndex.create(worldSizeLevel)
  const terrainSnapshot = createWorldTerrainSnapshot(worldSizeLevel)
  const camera = Camera.newUsingBuffer(args.cameraBuffer)
  const context = await newContextWrapper(args.canvas, camera)
  const globals = makeShaderGlobals(context.rawContext)

  stats.setRendererName(context.getRendererName())
  scheduler.setWorld(decodedGame.world[PASS]())

  const pipeline: NewRenderingPipeline = {
    gl: context.rawContext,
    visibility,
    terrainSnapshot,
  }

  const pipelineElements: NewRenderingPipelineElement[] = createElements({
    pipeline,
    game: decodedGame,
    globals,
    scheduler,
  })

  let lastTrueRenderedTick = -1
  let consecutiveMutexTimeouts = 0

  const performRender = async (elapsedSeconds: number, secondsSinceFirstRender: number) => {
    stats.frames.frameStarted()
    timeMeter.beginSession(DrawPhase.LockMutex)

    let gameTickValue = gameTickEstimation()
    const intEstimation = Math.floor(gameTickValue)
    let shouldSyncWorld = false

    if (intEstimation > lastTrueRenderedTick) {
      const timeoutMs = consecutiveMutexTimeouts ** 2 * 2 + 1 // keep at least 1ms timeout for acquire
      const acquired = isInWorker ? mutex.tryEnterForRender(timeoutMs) : await mutex.tryEnterForRenderAsync(timeoutMs)
      gameTickValue = gameTickEstimation()

      if (acquired) {
        consecutiveMutexTimeouts = 0
        const currentTick = decodedGame.currentTick
        if (currentTick !== lastTrueRenderedTick) {
          lastTrueRenderedTick = currentTick
          shouldSyncWorld = true
        } else {
          // TODO: collect late-timer event count in render debug stats
          // Late timer: estimation crossed into the next tick before update-worker committed it.
          // Release mutex immediately so update-worker can acquire it ASAP, and fall back to an extrapolated frame.
          mutex.exitRender()
        }
      } else {
        // TODO: collect consecutiveMutexTimeouts / extrapolated frame count in render debug stats
        consecutiveMutexTimeouts++
      }
    }

    timeMeter.nowStart(DrawPhase.UpdateWorld)
    const terrainHeight = CONFIG.get('rendering/terrain-height')
    try {
      if (shouldSyncWorld) {
        terrainSnapshot.syncFromGameWithMutexHeld(decodedGame)
      }

      context.updateCamera(elapsedSeconds, terrainSnapshot, terrainHeight)
      camera.updateMatrix()
      stats.setVisibleChunksCount(visibility.update(camera.combinedMatrix))

      if (shouldSyncWorld) {
        for (const e of pipelineElements) e.updateWorldSync()
      }
    } finally {
      if (shouldSyncWorld) {
        mutex.exitRender()
      }
    }

    timeMeter.nowStart(DrawPhase.GPUUpload)

    globals.update(
      camera,
      secondsSinceFirstRender,
      gameTickValue / STANDARD_GAME_TICK_RATE,
      gameTickValue,
      terrainHeight,
      worldSizeLevel,
    )

    for (const e of pipelineElements) e.uploadToGpu()

    timeMeter.nowStart(DrawPhase.Draw)
    context.prepareForDraw()
    for (const e of pipelineElements) e.draw()
    context.finalizeDisplay(elapsedSeconds)

    stats.updateWithTimeMeasurements(timeMeter.endSessionAndGetRawResults())
    stats.frames.frameEnded(elapsedSeconds * 1000)
  }

  const limiter = newFramesLimiter(args.canvas.frontendVariables)
  const caller = newAnimationFrameCaller(dt => limiter.shouldRender(dt), performRender)

  caller?.start()

  return {
    stats,
    terminate() {
      caller.stop()
      limiter.cleanUp()
      scheduler.terminate()
      globals.cleanUp()
    },
  }
}
