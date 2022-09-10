import * as vec3 from '@matrix/vec3'
import { GameState } from '../../game-state/game-state'
import { ActionsQueue } from '../../game-state/scheduled-actions/queue'
import { STANDARD_GAME_TICK_RATE, StateUpdater } from '../../game-state/state-updater'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { isInWorker, Lock } from '../../util/mutex'
import CONFIG, { observeSetting } from '../../util/persistance/observable-settings'
import { globalMutex } from '../../util/worker/global-mutex'
import { Camera } from '../camera'
import terrain from '../drawable/terrain'
import { MainRenderer } from '../main-renderer'
import { createPicker } from '../mouse-picker'
import { newPipeline } from '../pipeline'
import { createCombinedRenderable } from './combined-renderables'
import createInputReactor from './input-reactor'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly gameTickEstimation: number
	readonly gameTime: number
	readonly secondsSinceFirstRender: number
	readonly sunPosition: vec3
	readonly mousePicker: ReturnType<typeof createPicker>
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

const obtainWebGl2ContextFromCanvas = (canvas: HTMLCanvasElement): WebGL2RenderingContext => {
	const context = canvas.getContext('webgl2', {
		'alpha': false,
		'antialias': CONFIG.get('rendering/antialias'),
		'depth': true,
		'stencil': false,
		'failIfMajorPerformanceCaveat': true,
	}) as WebGL2RenderingContext
	if (context == null)
		throw new Error('Unable to obtain context')
	return context
}

const newAnimationFrameCaller = (
	shouldRender: (elapsedSeconds: number) => boolean,
	actualRender: (elapsedSeconds: number) => Promise<void>,
) => {
	let nextFrameRequest = 0;
	let lastFrameTime = 0

	const internalRenderFunction = async () => {
		const now = performance.now()
		const elapsedSeconds = (now - lastFrameTime) / 1000
		if ((shouldRender(elapsedSeconds)) === true) {
			await actualRender(elapsedSeconds)
		}

		// someone could cancel rendering in render callback
		if (nextFrameRequest !== 0)
			nextFrameRequest = requestAnimationFrame(internalRenderFunction)
	}

	return {
		start() {
			if (nextFrameRequest !== 0) return

			lastFrameTime = performance.now()

			nextFrameRequest = requestAnimationFrame(internalRenderFunction)
		},
		stop() {
			cancelAnimationFrame(nextFrameRequest)
			nextFrameRequest = 0
		},
	}
}

const newCanvasResizeWrapper = (canvas: HTMLCanvasElement, camera: Camera) => {
	const gl = obtainWebGl2ContextFromCanvas(canvas)

	const TEXTURE_PIXEL_MULTIPLIER = 1

	let lastWidth = -1
	let lastHeight = -1

	return {
		rawContext: gl,
		prepareForDrawing() {

			const width = frontedVariables[FrontendVariable.CanvasDrawingWidth]!
			const height = frontedVariables[FrontendVariable.CanvasDrawingHeight]!
			if (lastWidth !== width || lastHeight !== height) {
				camera.setAspectRatio(width / height)
				lastWidth = width
				lastHeight = height

				canvas['width'] = width * TEXTURE_PIXEL_MULTIPLIER | 0
				canvas['height'] = height * TEXTURE_PIXEL_MULTIPLIER | 0
			}
			gl.viewport(0, 0, width * TEXTURE_PIXEL_MULTIPLIER | 0, height * TEXTURE_PIXEL_MULTIPLIER | 0)

			gl.clearColor(0.15, 0.15, 0.15, 1)
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

			gl.enable(gl.DEPTH_TEST)
			gl.depthFunc(gl.LEQUAL)

			gl.cullFace(gl.BACK)
			gl.enable(gl.CULL_FACE)
		}
	}
}

export const startRenderingGame = (
	canvas: HTMLCanvasElement,
	game: GameState,
	updater: StateUpdater,
	actionsQueue: ActionsQueue,
	camera: Camera,
	gameTickEstimation: () => number): () => void => {

	const gameTickRate = () => updater.getTickRate()
	const handleInputEvents = createInputReactor(game, actionsQueue)

	const pipeline = newPipeline([terrain].map(e => e()))


	const canvasWrapper = newCanvasResizeWrapper(canvas, camera)
	const gl = canvasWrapper.rawContext

	const firstRenderTime = performance.now()
	const sunPosition = vec3.fromValues(500, 1500, -500)
	const performRender = async (elapsedSeconds: number) => {
		if (isInWorker)
			globalMutex.enter(Lock.Update)
		else
			await globalMutex.enterAsync(Lock.Update)

		pipeline.updateWorld()
		pipeline.prepareRender()

		globalMutex.unlock(Lock.Update)

		camera.updateMatrixIfNeeded()

		pipeline.doGpuUploads()

		const now = performance.now()
		const secondsSinceFirstRender = (now - firstRenderTime) / 1000
		const ctx: RenderContext = {
			gl,
			camera,
			sunPosition,
			gameTickEstimation: gameTickEstimation(),
			secondsSinceFirstRender,
			gameTime: secondsSinceFirstRender * gameTickRate() / STANDARD_GAME_TICK_RATE,
			// @ts-ignore
			mousePicker: {},
		}

		canvasWrapper.prepareForDrawing()
		pipeline.draw(ctx)
	}


	const caller = newAnimationFrameCaller(() => true, performRender)

	pipeline.useContext(gl)
	pipeline.useGame(game)
	pipeline.bindGpuWithGame()

	caller.start()

	return () => {
		caller.stop()
	}
}

