import * as vec3 from '@matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { ActionsQueue } from '../../game-state/scheduled-actions/queue'
import { STANDARD_GAME_TICK_RATE, StateUpdater } from '../../game-state/state-updater'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { GameMutex } from '../../util/game-mutex'
import { isInWorker, Lock } from '../../util/mutex'
import CONFIG, { observeSetting } from '../../util/persistance/observable-settings'
import { globalMutex } from '../../util/worker/global-mutex'
import { Camera } from '../camera'
import ChunkVisibilityIndex from '../drawable/chunk-visibility'
import terrain from '../drawable/terrain'
import { MainRenderer } from '../main-renderer'
import { newPipeline } from '../pipeline'
import { newMousePicker } from '../pipeline/mouse-picker'
import RenderHelperWorkScheduler from '../pipeline/work-scheduler'
import { newAnimationFrameCaller, newBeforeDrawWrapper as newDrawWrapper, newFramesLimiter, newInputHandler } from '../pipeline/wrappers'
import { createCombinedRenderable } from './combined-renderables'
import createInputReactor from './input-reactor'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly visibility: ChunkVisibilityIndex
	readonly gameTickEstimation: number
	readonly gameTime: number
	readonly secondsSinceFirstRender: number
	readonly sunPosition: [number, number, number]
}

export const setupSceneRendering = (canvas: HTMLCanvasElement,
	state: GameState,
	camera: Camera,
	gameTickEstimation: () => number,
	gameTickRate: () => number,
	handleInputEvents: (dt: number, r: MainRenderer, ctx: RenderContext) => Promise<void>)
	: () => void => {
	const renderer = MainRenderer.fromHTMLCanvas(canvas)

	const sunPosition = vec3.fromValues(500, 1500, -500)

	const firstRenderTime = performance.now()
	let lastContext: RenderContext | null = null

	const combinedRenderable = createCombinedRenderable(renderer, state)


	renderer.renderFunction = async (gl, dt) => {
		if (lastContext !== null)
			await handleInputEvents(dt, renderer, lastContext)
		camera.updateMatrixIfNeeded()

		if (isInWorker)
			globalMutex.enter(Lock.Update)
		else
			await globalMutex.enterAsync(Lock.Update)

		renderer.renderStarted()

		const now = performance.now()
		const secondsSinceFirstRender = (now - firstRenderTime) / 1000
		const ctx: Readonly<RenderContext> = Object.freeze({
			gl,
			camera,
			sunPosition,
			gameTickEstimation: gameTickEstimation(),
			secondsSinceFirstRender: secondsSinceFirstRender,
			mousePicker: combinedRenderable.mousePicker,
			gameTime: secondsSinceFirstRender * gameTickRate() / STANDARD_GAME_TICK_RATE,
		})
		lastContext = ctx

		combinedRenderable.render(ctx)

		globalMutex.unlock(Lock.Update)
	}

	let minSecondsBetweenFramesFocus = 0
	let minSecondsBetweenFramesBlur = 0

	const unsub1 = observeSetting('rendering/fps-cap', value => {
		minSecondsBetweenFramesFocus = (value <= 0) ? 0 : (1 / ((+value <= 0 ? 0.00001 : (+value * 1.4))))
	})
	const unsub2 = observeSetting('rendering/fps-cap-on-blur', value => {
		minSecondsBetweenFramesBlur = (value <= 0) ? 9999999 : 1 / ((+value <= 0 ? 0.00001 : (+value * 1.4)))
	})

	renderer.beforeRenderFunction = (secondsSinceLastFrame) => {
		const variables = Atomics.load(frontedVariables, FrontendVariable.AdditionalFlags)
		const hasFocus = (variables & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus
		return secondsSinceLastFrame >= (hasFocus ? minSecondsBetweenFramesFocus : minSecondsBetweenFramesBlur)
	}
	renderer.beginRendering()

	let cancelled = false
	return () => {
		if (cancelled) return
		cancelled = true
		unsub1()
		unsub2()
		renderer.stopRendering()
		renderer.cleanUp()
	}
}


export const startRenderingGameOld = (canvas: HTMLCanvasElement,
	game: GameState,
	updater: StateUpdater,
	actionsQueue: ActionsQueue,
	camera: Camera,
	gameTickEstimation: () => number): () => void => {

	const gameTickRate = () => updater.getTickRate()
	const handleInputEvents = createInputReactor(game, actionsQueue)

	return setupSceneRendering(canvas, game, camera, gameTickEstimation, gameTickRate, handleInputEvents)
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
	const pipeline = newPipeline([
		terrain,
	].map(e => e()))


	const scheduler = await RenderHelperWorkScheduler.createNew()

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

	return {
		setCanvas(canvas: HTMLCanvasElement) {
			if (lastCanvas !== null) {
				lastCanvas.caller.stop()
				lastCanvas.limiter.cleanUp()
			}

			const drawHelper = newDrawWrapper(canvas, camera)
			const mouse = newMousePicker(drawHelper.rawContext)
			const performRender = async (elapsedSeconds: number, secondsSinceFirstRender: number) => {
				inputHandler.handleInputsBeforeDraw(camera, elapsedSeconds)
				drawHelper.handleResize()
				if (camera.updateMatrixIfNeeded())
					visibility.update(camera.combinedMatrix)

				if (isInWorker)
					mutex.enterForRender()
				else
					await mutex.enterForRenderAsync()

				pipeline.updateWorldIfNeeded()
				pipeline.prepareRender()

				mutex.exitRender()

				pipeline.doGpuUploads()

				const ctx: RenderContext = {
					gl: drawHelper.rawContext,
					camera,
					sunPosition,
					visibility,
					gameTickEstimation: gameTickEstimation(),
					secondsSinceFirstRender,
					gameTime: secondsSinceFirstRender * gameTickRate() / STANDARD_GAME_TICK_RATE,
				}

				drawHelper.clearBeforeDraw()

				pipeline.draw(ctx)

				const inputs = inputHandler.shouldRenderForInputs()
				if (inputs !== null) {
					mouse.prepareBeforeDraw()
					pipeline.drawForMousePicker(ctx)
					const computed = mouse.pickAfterDraw(inputs.mouseX, inputs.mouseY)
					inputHandler.interpretPick(computed, inputs)
				}
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
			scheduler.setWorld(game.world.pass())
			pipeline.useGame(game, scheduler)
			pipeline.bindGpuWithGameIfCan()
		},
		setCamera(newCamera: Camera) {
			camera = newCamera
			visibility.update(newCamera.combinedMatrix)
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




export const startRenderingGame = (
	canvas: HTMLCanvasElement,
	game: GameState,
	updater: StateUpdater,
	actionsQueue: ActionsQueue,
	camera: Camera,
	gameTickEstimation: () => number): () => void => {
	const pipeline = /* @__PURE__ */ newPipeline([
		terrain,
	].map(e => e()))

	const gameTickRate = () => updater.getTickRate()


	const inputHandler = newInputHandler(actionsQueue)
	const drawHelper = newDrawWrapper(canvas, camera)
	const mouse = newMousePicker(drawHelper.rawContext)

	const sunPosition = vec3.fromValues(500, 1500, -500)
	const performRender = async (elapsedSeconds: number, secondsSinceFirstRender: number) => {
		inputHandler.handleInputsBeforeDraw(camera, elapsedSeconds)

		if (isInWorker)
			globalMutex.enter(Lock.Update)
		else
			await globalMutex.enterAsync(Lock.Update)

		pipeline.updateWorldIfNeeded()
		pipeline.prepareRender()

		globalMutex.unlock(Lock.Update)

		camera.updateMatrixIfNeeded()
		pipeline.doGpuUploads()

		const ctx: RenderContext = {
			gl: drawHelper.rawContext,
			camera,
			sunPosition,
			gameTickEstimation: gameTickEstimation(),
			secondsSinceFirstRender,
			gameTime: secondsSinceFirstRender * gameTickRate() / STANDARD_GAME_TICK_RATE,
		}

		drawHelper.handleResize()
		drawHelper.clearBeforeDraw()

		pipeline.draw(ctx)

		const inputs = inputHandler.shouldRenderForInputs()
		if (inputs !== null) {
			mouse.prepareBeforeDraw()
			pipeline.drawForMousePicker(ctx)
			const computed = mouse.pickAfterDraw(inputs.mouseX, inputs.mouseY)
			inputHandler.interpretPick(computed, inputs)
		}
	}

	const limiter = newFramesLimiter()
	const caller = newAnimationFrameCaller(limiter.shouldRender, performRender)

	pipeline.useContext(drawHelper.rawContext)
	pipeline.useGame(game,)
	pipeline.bindGpuWithGame()

	caller.start()

	return () => {
		caller.stop()
		limiter.cleanUp()
	}
}

