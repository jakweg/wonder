import { Camera } from '../../camera'
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from '../../util/frontend-variables'
import * as vec3 from '../../util/matrix/vec3'
import { Lock } from '../../util/mutex'
import { globalMutex } from '../../worker/worker-global-state'
import { GameState } from '../game-state/game-state'
import { MainRenderer } from '../main-renderer'
import { moveCameraByKeys } from './camera-keyboard-updater'
import { createCombinedRenderable } from './combined-renderables'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly gameTickEstimation: number
	readonly secondsSinceFirstRender: number
	readonly sunPosition: vec3
}

export const setupSceneRendering = (canvas: HTMLCanvasElement,
                                    state: GameState,
                                    gameTickEstimation: () => number) => {
	const renderer = MainRenderer.fromHTMLCanvas(canvas)
	const camera = Camera.newPerspective(90, 1280 / 720)
	camera.moveCamera(9.5, 0, 7)

	const sunPosition = vec3.fromValues(500, 1500, -500)

	const firstRenderTime = performance.now()
	let lastContext: RenderContext | null = null

	const combinedRenderable = createCombinedRenderable(renderer, state)

	renderer.renderFunction = async (gl, dt) => {
		await moveCameraByKeys(camera, dt)
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
			})
			lastContext = ctx

			combinedRenderable.render(ctx)
		})
	}


	renderer.beforeRenderFunction = (secondsSinceLastFrame) =>
		(frontedVariables[FrontendVariable.AdditionalFlags]! & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus
		|| secondsSinceLastFrame > 0.5
	renderer.beginRendering()
}
