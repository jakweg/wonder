import { Camera } from '../../camera'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import * as vec3 from '../../util/matrix/vec3'
import { Lock } from '../../util/mutex'
import { globalMutex } from '../../worker/worker-global-state'
import { GameState } from '../game-state/game-state'
import { MainRenderer } from '../main-renderer'
import { createPicker } from '../mouse-picker'
import { createCombinedRenderable } from './combined-renderables'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly gameTickEstimation: number
	readonly secondsSinceFirstRender: number
	readonly sunPosition: vec3
	readonly mousePicker: ReturnType<typeof createPicker>
}

export const setupSceneRendering = (canvas: HTMLCanvasElement,
                                    state: GameState,
                                    gameTickEstimation: () => number,
                                    handleInputEvents: (dt: number, ctx: RenderContext) => Promise<void>) => {
	const renderer = MainRenderer.fromHTMLCanvas(canvas)
	const camera = Camera.newPerspective(90, 1280 / 720)
	camera.moveCamera(9.5, 0, 7)

	const sunPosition = vec3.fromValues(500, 1500, -500)

	const firstRenderTime = performance.now()
	let lastContext: RenderContext | null = null

	const combinedRenderable = createCombinedRenderable(renderer, state)


	renderer.renderFunction = async (gl, dt) => {
		if (lastContext !== null)
			await handleInputEvents(dt, lastContext)
		camera.updateMatrixIfNeeded()

		await globalMutex.executeWithAcquiredAsync(Lock.Update, async () => {
			renderer.renderStarted()

			const now = performance.now()
			const ctx: Readonly<RenderContext> = Object.freeze({
				gl,
				camera,
				sunPosition,
				gameTickEstimation: gameTickEstimation(),
				secondsSinceFirstRender: (now - firstRenderTime) / 1000,
				mousePicker: combinedRenderable.mousePicker,
			})
			lastContext = ctx

			combinedRenderable.render(ctx)
		})
	}


	renderer.beforeRenderFunction = (secondsSinceLastFrame) => {
		const variables = Atomics.load(frontedVariables, FrontendVariable.AdditionalFlags)
		const windowHasFocus = (variables & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus
		return windowHasFocus || secondsSinceLastFrame > 0.5
	}
	renderer.beginRendering()
}
