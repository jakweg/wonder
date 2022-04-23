import * as vec3 from '@matrix/vec3'
import { Camera } from '../../camera'
import { GameState } from '../../game-state/game-state'
import { STANDARD_GAME_TICK_RATE, StateUpdater } from '../../game-state/state-updater'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import { isInWorker, Lock } from '../../util/mutex'
import { observeSetting } from '../../worker/observable-settings'
import { globalMutex, globalWorkerDelay } from '../../worker/worker-global-state'
import { MainRenderer } from '../main-renderer'
import { createPicker } from '../mouse-picker'
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

	return () => {
		unsub1()
		unsub2()
		renderer.stopRendering()
		renderer.cleanUp()
	}
}


export const startRenderingGame = (canvas: HTMLCanvasElement, game: GameState, updater: StateUpdater, camera: Camera): () => void => {
	const gameTickEstimation = () => updater.estimateCurrentGameTickTime(globalWorkerDelay.difference)
	const gameTickRate = () => updater.getTickRate()
	const handleInputEvents = createInputReactor(game)

	return setupSceneRendering(canvas, game, camera, gameTickEstimation, gameTickRate, handleInputEvents)
}

