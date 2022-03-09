import { GameState } from './3d-stuff/game-state/game-state'
import { StateUpdater, stateUpdaterFromReceived } from './3d-stuff/game-state/state-updater'
import { startRenderingGame } from './3d-stuff/renderable/render-context'
import { Camera } from './camera'
import { initFrontedVariablesFromReceived } from './util/frontend-variables'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { Connection, setMessageHandler } from './worker/message-handler'
import { globalMutex, globalWorkerDelay, setGlobalMutex } from './worker/worker-global-state'

takeControlOverWorkerConnection()

let canvas: HTMLCanvasElement | null = null
let gameSnapshot: unknown | null = null
let decodedGame: GameState | null = null
let decodedUpdater: StateUpdater | null = null
let cameraBuffer: SharedArrayBuffer | null = null
let connectionWithParent: Connection

setMessageHandler('set-global-mutex', (data, connection) => {
	setGlobalMutex(data.mutex)
	connectionWithParent = connection
})

setMessageHandler('transfer-canvas', (data) => {
	if (canvas !== null)
		throw new Error('Canvas is already not null')

	canvas = data.canvas as HTMLCanvasElement
	considerStartRendering()
})

setMessageHandler('set-worker-load-delays', ({update, render}) => {
	globalWorkerDelay.difference = update - render
})

setMessageHandler('game-snapshot-for-renderer', (data) => {
	gameSnapshot = data
	considerStartRendering()
})

setMessageHandler('update-entity-container', (data) => {
	decodedGame!.entities.replaceBuffersFromReceived(data)
})

setMessageHandler('camera-buffer', (data) => {
	cameraBuffer = data.buffer
})

setMessageHandler('frontend-variables', ({buffer}) => {
	initFrontedVariablesFromReceived(buffer)
})


const considerStartRendering = () => {
	if (decodedGame === null && canvas !== null && gameSnapshot !== null) {
		const snapshot = gameSnapshot as any
		decodedGame = GameState.forRenderer(snapshot['game'])
		decodedUpdater = stateUpdaterFromReceived(globalMutex, snapshot['updater'])

		const camera = cameraBuffer ? Camera.newUsingBuffer(cameraBuffer) : Camera.newPerspective()

		startRenderingGame(canvas, decodedGame, decodedUpdater, camera)
	}
}
