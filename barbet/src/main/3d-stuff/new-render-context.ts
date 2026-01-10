import { Camera } from '@3d/camera'
import ChunkVisibilityIndex from '@3d/chunk-visibility'
import { createElements } from '@3d/elements'
import { makeShaderGlobals, ShaderGlobals } from '@3d/global-gpu-resources'
import RenderHelperWorkScheduler, { newHelperScheduler } from '@3d/pipeline/work-scheduler'
import { newAnimationFrameCaller, newContextWrapper, newFramesLimiter } from '@3d/pipeline/wrappers'
import { createGameStateForRenderer, GameState } from '@game'
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
  workerStartDelayDifference: number
}

interface NewRenderingPipeline {
  readonly gl: WebGL2RenderingContext
  readonly visibility: ChunkVisibilityIndex
}

interface NewRenderingPipelineElement {
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
  const decodedUpdater = createStateUpdaterControllerFromReceived(args.updater)
  const gameTickEstimation = () => decodedUpdater.estimateCurrentGameTickTime(args.workerStartDelayDifference)
  const scheduler = await newHelperScheduler(mutex)
  const visibility = ChunkVisibilityIndex.create(decodedGame.world.sizeLevel)
  const camera = Camera.newUsingBuffer(args.cameraBuffer)
  const context = await newContextWrapper(args.canvas, camera)
  const globals = makeShaderGlobals(context.rawContext)

  stats.setRendererName(context.getRendererName())
  scheduler.setWorld(decodedGame.world.pass())

  const pipeline: NewRenderingPipeline = {
    gl: context.rawContext,
    visibility: visibility,
  }

  const pipelineElements: NewRenderingPipelineElement[] = createElements({
    pipeline,
    game: decodedGame,
    globals,
    scheduler,
  })

  const performRender = async (elapsedSeconds: number, secondsSinceFirstRender: number) => {
    stats.frames.frameStarted()
    timeMeter.beginSession(DrawPhase.LockMutex)

    if (isInWorker) mutex.enterForRender()
    else await mutex.enterForRenderAsync()

    timeMeter.nowStart(DrawPhase.UpdateWorld)
    const terrainHeight = CONFIG.get('rendering/terrain-height')
    context.updateCameraWithMutexHeld(elapsedSeconds, decodedGame, terrainHeight)
    camera.updateMatrix()
    stats.setVisibleChunksCount(visibility.update(camera.combinedMatrix))

    const gameTickValue = gameTickEstimation()

    for (const e of pipelineElements) e.updateWorldSync()

    mutex.exitRender()

    timeMeter.nowStart(DrawPhase.GPUUpload)

    globals.update(
      camera,
      secondsSinceFirstRender,
      (secondsSinceFirstRender * decodedUpdater.getTickRate()) / STANDARD_GAME_TICK_RATE,
      gameTickValue,
      terrainHeight,
      decodedGame.world.sizeLevel,
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
