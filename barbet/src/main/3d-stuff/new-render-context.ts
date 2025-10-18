import { Camera } from '@3d/camera'
import { moveCameraByKeys } from '@3d/camera-keyboard-updater'
import ChunkVisibilityIndex from '@3d/drawable/chunk-visibility'
import { createElements } from '@3d/elements'
import { makeShaderGlobals, ShaderGlobals } from '@3d/global-gpu-resources'
import RenderHelperWorkScheduler, { newHelperScheduler } from '@3d/pipeline/work-scheduler'
import { newAnimationFrameCaller, newContextWrapper, newFramesLimiter } from '@3d/pipeline/wrappers'
import { createGameStateForRenderer, GameState } from '@game'
import { createStateUpdaterControllerFromReceived, STANDARD_GAME_TICK_RATE } from '@game/state-updater'
import { gameMutexFrom, isInWorker } from '@utils/game-mutex'
import CONFIG from '@utils/persistence/observable-settings'
import { UICanvas } from 'src/main/ui/canvas-background'

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
  uploadToGpu(pipeline: NewRenderingPipeline): void
  draw(pipeline: NewRenderingPipeline): void
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
  const mutex = gameMutexFrom(args.passedMutex)
  const decodedGame = createGameStateForRenderer(args.passedGame)
  const decodedUpdater = createStateUpdaterControllerFromReceived(args.updater)
  const gameTickEstimation = () => decodedUpdater.estimateCurrentGameTickTime(args.workerStartDelayDifference)
  const scheduler = await newHelperScheduler(mutex)
  const visibility = ChunkVisibilityIndex.create(decodedGame.world.sizeLevel)
  const camera = Camera.newUsingBuffer(args.cameraBuffer)
  const context = await newContextWrapper(args.canvas, camera)
  const globals = makeShaderGlobals(context.rawContext)

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
    moveCameraByKeys(camera, args.canvas.frontendVariables, elapsedSeconds)
    if (camera.updateMatrixIfNeeded()) {
      visibility.update(camera.combinedMatrix)
    }

    if (isInWorker) mutex.enterForRender()
    else await mutex.enterForRenderAsync()

    const gameTickValue = gameTickEstimation()

    for (const e of pipelineElements) e.updateWorldSync()

    mutex.exitRender()

    globals.update(
      camera,
      secondsSinceFirstRender,
      (secondsSinceFirstRender * decodedUpdater.getTickRate()) / STANDARD_GAME_TICK_RATE,
      gameTickValue,
      CONFIG.get('rendering/terrain-height'),
      decodedGame.world.sizeLevel,
    )

    for (const e of pipelineElements) e.uploadToGpu(pipeline)

    context.prepareForDraw()
    for (const e of pipelineElements) e.draw(pipeline)
    context.finalizeDisplay()
  }

  const limiter = newFramesLimiter(args.canvas.frontendVariables)
  const caller = newAnimationFrameCaller(dt => limiter.shouldRender(dt), performRender)

  caller?.start()

  return {
    terminate() {
      caller.stop()
      limiter.cleanUp()
      scheduler.terminate()
      globals.cleanUp()
    },
  }
}
