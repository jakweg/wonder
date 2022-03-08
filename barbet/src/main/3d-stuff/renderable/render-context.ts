import { Camera } from '../../camera'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import * as vec3 from '../../util/matrix/vec3'
import { isInWorker, Lock } from '../../util/mutex'
import { globalMutex, globalWorkerDelay } from '../../worker/worker-global-state'
import { GameState } from '../game-state/game-state'
import { STANDARD_GAME_TICK_RATE, StateUpdater } from '../game-state/state-updater'
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
                                    gameTickEstimation: () => number,
                                    gameTickRate: () => number,
                                    handleInputEvents: (dt: number, r: MainRenderer, ctx: RenderContext) => Promise<void>) => {
	const renderer = MainRenderer.fromHTMLCanvas(canvas)
	const camera = Camera.newPerspective()
	camera.moveCamera(9.5, 0, 7)

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


	renderer.beforeRenderFunction = (secondsSinceLastFrame) => {
		const variables = Atomics.load(frontedVariables, FrontendVariable.AdditionalFlags)
		return (variables & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus || secondsSinceLastFrame > 0.5
	}
	renderer.beginRendering()
}


export const startRenderingGame = (canvas: HTMLCanvasElement, game: GameState, updater: StateUpdater) => {
	const gameTickEstimation = () => updater.estimateCurrentGameTickTime(globalWorkerDelay.difference)
	const gameTickRate = () => updater.getTickRate()
	const handleInputEvents = createInputReactor(game)

	setupSceneRendering(canvas, game, gameTickEstimation, gameTickRate, handleInputEvents)
}

