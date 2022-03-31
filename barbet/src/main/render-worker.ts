import { GameState } from './3d-stuff/game-state/game-state'
import { StateUpdater, stateUpdaterFromReceived } from './3d-stuff/game-state/state-updater'
import { startRenderingGame } from './3d-stuff/renderable/render-context'
import { Camera } from './camera'
import { initFrontedVariablesFromReceived } from './util/frontend-variables-updaters'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { Connection, setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'
import { globalMutex, globalWorkerDelay, setGlobalMutex } from './worker/worker-global-state'

SettingsContainer.INSTANCE = SettingsContainer.createEmpty()
takeControlOverWorkerConnection()

let renderCancelCallback: () => void = () => void 0
let canvas: HTMLCanvasElement | null = null
let gameSnapshot: unknown | null = null
let decodedGame: GameState | null = null
let decodedUpdater: StateUpdater | null = null
let cameraBuffer: SharedArrayBuffer | null = null
let connectionWithParent: Connection

setMessageHandler('set-global-mutex', (data, connection) => {
	setGlobalMutex(data['mutex'])
	connectionWithParent = connection
})

setMessageHandler('new-settings', settings => {
	SettingsContainer.INSTANCE.update(settings)
})

setMessageHandler('transfer-canvas', (data) => {
	canvas = data['canvas'] as HTMLCanvasElement
	considerStartRendering()
})

setMessageHandler('set-worker-load-delays', (data) => {
	globalWorkerDelay.difference = data['update'] - data['render']
})

setMessageHandler('game-snapshot-for-renderer', (data) => {
	gameSnapshot = data
	considerStartRendering()
})

setMessageHandler('update-entity-container', (data) => {
	decodedGame!.entities.replaceBuffersFromReceived(data)
})

setMessageHandler('camera-buffer', (data) => {
	cameraBuffer = data['buffer']
})

setMessageHandler('frontend-variables', (data) => {
	initFrontedVariablesFromReceived(data['buffer'])
})

setMessageHandler('terminate-game', () => {
	renderCancelCallback?.()
	canvas = decodedUpdater = decodedGame = gameSnapshot = null
})


const considerStartRendering = () => {
	if (decodedGame === null && gameSnapshot !== null) {
		const snapshot = gameSnapshot as any
		decodedGame = GameState.forRenderer(snapshot['game'])
		decodedUpdater = stateUpdaterFromReceived(globalMutex, snapshot['updater'])
	}

	if (canvas !== null && decodedGame !== null && decodedUpdater !== null) {
		const camera = cameraBuffer ? Camera.newUsingBuffer(cameraBuffer) : Camera.newPerspective()

		renderCancelCallback?.()
		renderCancelCallback = startRenderingGame(canvas, decodedGame, decodedUpdater, camera)
	}
}
