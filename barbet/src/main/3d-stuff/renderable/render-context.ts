import * as vec3 from '@matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { ActionsQueue } from '../../game-state/scheduled-actions/queue'
import { STANDARD_GAME_TICK_RATE, StateUpdater } from '../../game-state/state-updater'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { isInWorker, Lock } from '../../util/mutex'
import { observeSetting } from '../../util/persistance/observable-settings'
import { globalMutex } from '../../util/worker/global-mutex'
import { Camera } from '../camera'
import terrain from '../drawable/terrain'
import { MainRenderer } from '../main-renderer'
import { newPipeline } from '../pipeline'
import { newMousePicker } from '../pipeline/mouse-picker'
import { newAnimationFrameCaller, newBeforeDrawWrapper as newDrawWrapper, newFramesLimiter, newInputHandler } from '../pipeline/wrappers'
import { createCombinedRenderable } from './combined-renderables'
import createInputReactor from './input-reactor'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
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


export const startRenderingGame = (
	canvas: HTMLCanvasElement,
	game: GameState,
	updater: StateUpdater,
	actionsQueue: ActionsQueue,
	camera: Camera,
	gameTickEstimation: () => number): () => void => {

	const gameTickRate = () => updater.getTickRate()

	const pipeline = newPipeline([
		terrain,
	].map(e => e()))

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

		pipeline.updateWorld()
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
	pipeline.useGame(game)
	pipeline.bindGpuWithGame()

	caller.start()

	return () => {
		caller.stop()
		limiter.cleanUp()
	}
}

