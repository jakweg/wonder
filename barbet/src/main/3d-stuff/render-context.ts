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
import genericEntity from './drawable/generic-entity'
import terrain from './drawable/terrain'
import { GlProgram } from './gpu-resources'
import { newPipeline } from './pipeline'
import { GpuAllocator } from './pipeline/allocator'
import { newMousePicker } from './pipeline/mouse-picker'
import { newHelperScheduler } from './pipeline/work-scheduler'
import { newAnimationFrameCaller, newBeforeDrawWrapper as newDrawWrapper, newFramesLimiter, newInputHandler } from './pipeline/wrappers'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly visibility: ChunkVisibilityIndex
	readonly stats: RenderDebugDataCollector
}

interface CanvasObjects {
	canvas: HTMLCanvasElement,
	limiter: ReturnType<typeof newFramesLimiter>
	caller: ReturnType<typeof newAnimationFrameCaller>
	loadingShadersPromise: Promise<void>
}


const makeShaderGlobals = (allocator: GpuAllocator) => {
	const BUFFER = new Float32Array(0
		+ 16 // camera matrix
		+ 4 // times (last field is ignored)
		+ 4 // light direction + ambient
	)

	const { buffer, raw } = allocator.newUniformBuffer()
	const light = [0.55, 1, -0.6, 0.4]
	vec3.normalize(light, light)

	return ({
		bindProgram<A extends string, U extends string>(program: GlProgram<A, U>): GlProgram<A, U> {
			const BINDING_POINT = 0
			const gl = program.rawGl()
			const programRaw = program.rawHandle();
			const blockIndex = gl.getUniformBlockIndex(programRaw, 'Globals')

			gl.uniformBlockBinding(programRaw, blockIndex, BINDING_POINT)
			gl.bindBufferBase(gl.UNIFORM_BUFFER, BINDING_POINT, raw)

			return program
		},
		update(camera: Camera,
			secondsSinceFirstRender: number, gameTime: number, gameTickEstimation: number) {

			const combinedMatrix = camera.combinedMatrix
			for (let i = 0; i < 16; ++i)
				BUFFER[i] = combinedMatrix[i]

			BUFFER[16 + 0] = secondsSinceFirstRender
			BUFFER[16 + 1] = gameTime
			BUFFER[16 + 2] = gameTickEstimation
			BUFFER[16 + 4] = light[0]!
			BUFFER[16 + 5] = light[1]!
			BUFFER[16 + 6] = light[2]!
			BUFFER[16 + 7] = light[3]!

			buffer.setContent(BUFFER)
		}
	})
}

export type ShaderGlobals = ReturnType<typeof makeShaderGlobals>

export const createRenderingSession = async (
	actionsQueue: ActionsQueue,
	mutex: GameMutex,) => {
	const stats = new RenderDebugDataCollector(new FramesMeter(FRAMES_COUNT_RENDERING))
	const pipeline = newPipeline(makeShaderGlobals,
		[
			terrain(),
			genericEntity(),
			graphRenderer(),
		])


	const scheduler = await newHelperScheduler(mutex)

	const inputHandler = newInputHandler(actionsQueue)

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
				const gameTickValue = gameTickEstimation()
				pipeline.updateWorldIfNeeded()

				timeMeter.nowStart(DrawPhase.PrepareRender)
				pipeline.prepareRender()

				mutex.exitRender()

				timeMeter.nowStart(DrawPhase.GPUUpload)
				pipeline.getGlobals().update(
					camera,
					secondsSinceFirstRender,
					secondsSinceFirstRender * gameTickRate() / STANDARD_GAME_TICK_RATE,
					gameTickValue)

				pipeline.doGpuUploads()

				timeMeter.nowStart(DrawPhase.Draw)
				const ctx: RenderContext = {
					gl: drawHelper.rawContext,
					camera,
					stats,
					visibility,
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
			pipeline.useGame(game, scheduler, visibility)
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
