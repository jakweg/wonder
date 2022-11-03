import * as vec3 from '@matrix/vec3'
import { GameState } from '../game-state/game-state'
import { ActionsQueue } from '../game-state/scheduled-actions/queue'
import { STANDARD_GAME_TICK_RATE } from '../game-state/state-updater'
import { GameMutex, isInWorker } from '../util/game-mutex'
import CONFIG from '../util/persistance/observable-settings'
import { observeField, reduce } from '../util/state/subject'
import { DrawPhase } from '../util/worker/debug-stats/draw-phase'
import { FramesMeter } from '../util/worker/debug-stats/frames-meter'
import graphRenderer, { FRAMES_COUNT_RENDERING } from '../util/worker/debug-stats/graph-renderer'
import { RenderDebugDataCollector } from '../util/worker/debug-stats/render'
import TimeMeter from '../util/worker/debug-stats/time-meter'
import { Camera } from './camera'
import ChunkVisibilityIndex from './drawable/chunk-visibility'
import slime from './drawable/slime'
import terrain from './drawable/terrain'
import { newPipeline } from './pipeline'
import { newMousePicker } from './pipeline/mouse-picker'
import { newHelperScheduler } from './pipeline/work-scheduler'
import { newAnimationFrameCaller, newBeforeDrawWrapper as newDrawWrapper, newFramesLimiter, newInputHandler } from './pipeline/wrappers'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly visibility: ChunkVisibilityIndex
	readonly stats: RenderDebugDataCollector
	readonly gameTickEstimation: number
	readonly gameTime: number
	readonly secondsSinceFirstRender: number
	readonly sunPosition: [number, number, number]
}

interface CanvasObjects {
	canvas: HTMLCanvasElement,
	limiter: ReturnType<typeof newFramesLimiter>
	caller: ReturnType<typeof newAnimationFrameCaller>
	loadingShadersPromise: Promise<void>
}


export const createRenderingSession = async (
	actionsQueue: ActionsQueue,
	mutex: GameMutex,) => {
	const stats = new RenderDebugDataCollector(new FramesMeter(FRAMES_COUNT_RENDERING))
	const pipeline = newPipeline([
		terrain(),
		slime(),
		graphRenderer(),
	])


	const scheduler = await newHelperScheduler(mutex)

	const inputHandler = newInputHandler(actionsQueue)
	const sunPosition = vec3.fromValues(500, 1500, -500)

	let gameTickEstimation = () => 0
	let gameTickRate = () => 1
	let hadGame: boolean = false
	let camera = Camera.newPerspective()
	let visibility = ChunkVisibilityIndex.create(0, 0)

	let lastCanvas: CanvasObjects | null = null

	const cancelObserver = CONFIG.observeEverything(() => {
		pipeline.notifyConfigChanged()
	})

	CONFIG.observe('debug/disable-culling', v => {
		visibility.setCullingDisabled(v)
		if (camera)
			stats.setVisibleChunksCount(visibility.update(camera.combinedMatrix))
	})

	return {
		stats,
		setCanvas(canvas: HTMLCanvasElement) {
			if (lastCanvas !== null) {
				lastCanvas.caller.stop()
				lastCanvas.limiter.cleanUp()
			}

			const drawHelper = newDrawWrapper(canvas, camera)
			stats.setRendererName(drawHelper.getRendererName())
			const mouse = newMousePicker(drawHelper.rawContext)
			const timeMeter = new TimeMeter<DrawPhase>(DrawPhase.SIZE)

			reduce([
				observeField(CONFIG, 'debug/show-info'),
				observeField(CONFIG, 'debug/show-graphs')
			], (v, a) => (a || v), false)
				.on(v => timeMeter.setEnabled(!!v))

			const performRender = async (elapsedSeconds: number, secondsSinceFirstRender: number) => {
				stats.frames.frameStarted()
				timeMeter.beginSession(DrawPhase.HandleInputs)

				inputHandler.handleInputsBeforeDraw(camera, elapsedSeconds)
				drawHelper.handleResize()

				if (camera.updateMatrixIfNeeded()) {
					const count = visibility.update(camera.combinedMatrix)
					stats.setVisibleChunksCount(count)
				}

				timeMeter.nowStart(DrawPhase.LockMutex)

				if (isInWorker)
					mutex.enterForRender()
				else
					await mutex.enterForRenderAsync()

				timeMeter.nowStart(DrawPhase.UpdateWorld)
				pipeline.updateWorldIfNeeded()

				timeMeter.nowStart(DrawPhase.PrepareRender)
				pipeline.prepareRender()

				mutex.exitRender()

				timeMeter.nowStart(DrawPhase.GPUUpload)
				pipeline.doGpuUploads()

				timeMeter.nowStart(DrawPhase.Draw)
				const ctx: RenderContext = {
					gl: drawHelper.rawContext,
					camera,
					stats,
					sunPosition,
					visibility,
					gameTickEstimation: gameTickEstimation(),
					secondsSinceFirstRender,
					gameTime: secondsSinceFirstRender * gameTickRate() / STANDARD_GAME_TICK_RATE,
				}

				drawHelper.clearBeforeDraw()

				pipeline.draw(ctx)

				timeMeter.nowStart(DrawPhase.DrawForMousePicker)
				const inputs = inputHandler.shouldRenderForInputs()
				if (inputs !== null) {
					mouse.prepareBeforeDraw()
					pipeline.drawForMousePicker(ctx)
					const computed = mouse.pickAfterDraw(inputs.mouseX, inputs.mouseY)
					inputHandler.interpretPick(computed, inputs)
				}
				stats.updateWithTimeMeasurements(timeMeter.endSessionAndGetRawResults())
				stats.frames.frameEnded()
			}

			const limiter = newFramesLimiter()
			const caller = newAnimationFrameCaller((dt) => hadGame && limiter.shouldRender(dt), performRender)

			const loadingShadersPromise = pipeline.useContext(drawHelper.rawContext)
			loadingShadersPromise
				.then(() => {
					pipeline.bindGpuWithGameIfCan()
					lastCanvas?.caller?.start()
				})
				.catch(e => console.error('Refused to start rendering:', e))

			lastCanvas = {
				caller, limiter, canvas, loadingShadersPromise
			}
		},
		setGame(game: GameState, _gameTickEstimation: () => number, _gameTickRate: () => number) {
			hadGame = true
			gameTickRate = _gameTickRate
			gameTickEstimation = _gameTickEstimation
			visibility = ChunkVisibilityIndex.create(game.world.size.chunksSizeX, game.world.size.chunksSizeZ)
			visibility.setCullingDisabled(CONFIG.get('debug/disable-culling'))
			scheduler.setWorld(game.world.pass())
			pipeline.useGame(game, scheduler)
			pipeline.bindGpuWithGameIfCan()
		},
		setCamera(newCamera: Camera) {
			camera = newCamera
			stats.setVisibleChunksCount(visibility.update(newCamera.combinedMatrix))
		},
		cleanUp() {
			if (lastCanvas !== null) {
				lastCanvas.caller.stop()
				lastCanvas.limiter.cleanUp()
			}
			lastCanvas = null
			hadGame = false

			pipeline.cleanUp()
			cancelObserver()
			scheduler.terminate()
		},
	}
}
