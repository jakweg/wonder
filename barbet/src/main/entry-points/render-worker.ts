import { Camera } from '../3d-stuff/camera'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../game-state/game-state'
import { SendActionsQueue } from '../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import CONFIG from '../util/persistance/observable-settings'
import { takeControlOverWorkerConnection } from '../util/worker/connections-manager'
import { setGlobalMutex } from '../util/worker/global-mutex'

const connectionWithParent = takeControlOverWorkerConnection()

let renderCancelCallback: () => void = () => void 0
let workerStartDelayDifference = 0
let canvas: HTMLCanvasElement | null = null
let gameSnapshot: unknown | null = null
let decodedGame: GameState | null = null
let decodedUpdater: StateUpdater | null = null
let cameraBuffer: SharedArrayBuffer | null = null

connectionWithParent.listen('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})

connectionWithParent.listen('new-settings', settings => {
	CONFIG.update(settings)
})

connectionWithParent.listen('transfer-canvas', (data) => {
	canvas = data.canvas as HTMLCanvasElement
	considerStartRendering()
})

connectionWithParent.listen('set-worker-load-delays', (data) => {
	workerStartDelayDifference = data.update - data.render
})

connectionWithParent.listen('game-snapshot-for-renderer', (data) => {
	gameSnapshot = data
	considerStartRendering()
})

connectionWithParent.listen('update-entity-container', (data) => {
	decodedGame!.entities.replaceBuffersFromReceived(data)
})

connectionWithParent.listen('camera-buffer', (data) => {
	cameraBuffer = data.buffer
})

connectionWithParent.listen('frontend-variables', (data) => {
	initFrontedVariablesFromReceived(data.buffer)
})

connectionWithParent.listen('terminate-game', () => {
	renderCancelCallback?.()
	canvas = decodedUpdater = decodedGame = gameSnapshot = null
})


const considerStartRendering = () => {
	if (decodedGame === null && gameSnapshot !== null) {
		const snapshot = gameSnapshot as any
		decodedGame = createGameStateForRenderer(snapshot.game)
		decodedUpdater = createStateUpdaterControllerFromReceived(snapshot.updater)
	}

	if (canvas !== null && decodedGame !== null && decodedUpdater !== null) {
		const camera = cameraBuffer ? Camera.newUsingBuffer(cameraBuffer) : Camera.newPerspective()

		const queue = SendActionsQueue.create(action => connectionWithParent.send('scheduled-action', action))

		renderCancelCallback?.()
		const gameTickEstimation = () => decodedUpdater!.estimateCurrentGameTickTime(workerStartDelayDifference)
		renderCancelCallback = startRenderingGame(canvas, decodedGame, decodedUpdater, queue, camera, gameTickEstimation)
	}
}
