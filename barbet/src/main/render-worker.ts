import { GameState } from './3d-stuff/game-state/game-state'
import { stateUpdaterFromReceived } from './3d-stuff/game-state/state-updater'
import { MainRenderer } from './3d-stuff/main-renderer'
import { createPicker } from './3d-stuff/mouse-picker'
import createHeldItemRenderable from './3d-stuff/renderable/held-item/held-item'
import createNewItemOnGroundRenderable from './3d-stuff/renderable/item-on-ground/item-on-ground'
import { RenderContext } from './3d-stuff/renderable/render-context'
import { createNewTerrainRenderable } from './3d-stuff/renderable/terrain/terrain'
import { createNewUnitRenderable } from './3d-stuff/renderable/unit/unit'
import { Camera } from './camera'
import * as vec3 from './util/matrix/vec3'
import { Lock } from './util/mutex'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { Connection, setMessageHandler } from './worker/message-handler'
import { globalMutex, setGlobalMutex } from './worker/worker-global-state'

takeControlOverWorkerConnection()

let canvas: HTMLCanvasElement | null = null
let gameSnapshot: unknown | null = null
let parent: Connection
let myDelay = 0
let updateWorkerDelay = 0

setMessageHandler('set-global-mutex', (data, connection) => {
	setGlobalMutex(data.mutex)
	parent = connection
})


setMessageHandler('transfer-canvas', (data) => {
	if (canvas !== null)
		throw new Error('Canvas is already not null')

	canvas = data.canvas as HTMLCanvasElement
	considerStartRendering()
})

setMessageHandler('set-worker-load-delays', ({update, render}) => {
	updateWorkerDelay = update
	myDelay = render
	if (stuff !== null)
		stuff.workerStartDelay = updateWorkerDelay - myDelay
})


interface GameFrontendStuff {
	workerStartDelay: number,
	state: GameState,
	updater: ReturnType<typeof stateUpdaterFromReceived>
	terrain: ReturnType<typeof createNewTerrainRenderable>,
	units: ReturnType<typeof createNewUnitRenderable>
	heldItems: ReturnType<typeof createHeldItemRenderable>,
	groundItems: ReturnType<typeof createNewItemOnGroundRenderable>,
	mousePicker: ReturnType<typeof createPicker>
}

let stuff: GameFrontendStuff | null = null
let renderer: MainRenderer

const setupWithCanvas = (canvas: HTMLCanvasElement) => {
	renderer = MainRenderer.fromHTMLCanvas(canvas)
	const camera = Camera.newPerspective(90, 1280 / 720)
	camera.moveCamera(9.5, 0, 7)


	const sunPosition = vec3.fromValues(-500, 500, -500)

	const firstRenderTime = performance.now()
	let lastContext: RenderContext | null = null
	renderer.renderFunction = async (gl, dt) => {
		await globalMutex.executeWithAcquiredAsync(Lock.Update, () => {
			const nowStuff = stuff
			if (nowStuff === null) return

			renderer.renderStarted()

			const now = performance.now()

			const ctx: RenderContext = {
				gl,
				camera,
				sunPosition,
				gameTickEstimation: nowStuff.updater.estimateCurrentGameTickTime(updateWorkerDelay - myDelay),
				secondsSinceFirstRender: (now - firstRenderTime) / 1000,
			}
			lastContext = ctx
			// moveCameraByKeys(camera, dt)
			camera.updateMatrixIfNeeded()
			Object.freeze(ctx)

			const r = 200
			// sunPosition[0] = Math.cos(ctx.secondsSinceFirstRender) * r + 10
			// sunPosition[2] = Math.sin(ctx.secondsSinceFirstRender) * r + 10
			sunPosition[0] = Math.cos(1) * r + 10
			sunPosition[2] = Math.sin(1) * r + 10

			nowStuff.terrain.render(ctx)
			nowStuff.units.render(ctx)
			nowStuff.heldItems.render(ctx)
			nowStuff.groundItems.render(ctx)
		})
	}


	renderer.beforeRenderFunction = (secondsSinceLastFrame) => true
	renderer.beginRendering()


}

function recreateGameState(data: any, delay: number, connection: Connection) {
	const updater = stateUpdaterFromReceived(globalMutex, connection, data['updater'])
	const state = GameState.forRenderer(data['game'])
	const units = createNewUnitRenderable(renderer, state)
	const terrain = createNewTerrainRenderable(renderer, state.world)
	stuff = {
		state, updater,
		terrain, units,
		workerStartDelay: delay,
		groundItems: createNewItemOnGroundRenderable(renderer, state),
		heldItems: createHeldItemRenderable(renderer, state),
		mousePicker: createPicker(renderer.rawContext, [terrain.renderForMousePicker, units.renderForMousePicker]),
	}
}

function considerStartRendering() {
	if (canvas !== null && gameSnapshot !== null) {
		setupWithCanvas(canvas)
		recreateGameState(gameSnapshot, updateWorkerDelay - myDelay, parent)
		stuff?.updater.start(20)
	}
}

setMessageHandler('game-snapshot-for-renderer', (data) => {
	gameSnapshot = data
	considerStartRendering()
})
