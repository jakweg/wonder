import { startRenderingGame } from './3d-stuff/renderable/render-context'
import { Camera } from './camera'
import { createGameStateForRenderer, GameState } from './game-state/game-state'
import { SendActionsQueue } from './game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from './game-state/state-updater'
import { initFrontedVariablesFromReceived } from './util/frontend-variables-updaters'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { Connection, setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'
import { globalWorkerDelay, setGlobalMutex } from './worker/worker-global-state'

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
		decodedGame = createGameStateForRenderer(snapshot['game'])
		decodedUpdater = createStateUpdaterControllerFromReceived(snapshot['updater'])
	}

	if (canvas !== null && decodedGame !== null && decodedUpdater !== null) {
		const camera = cameraBuffer ? Camera.newUsingBuffer(cameraBuffer) : Camera.newPerspective()

		const queue = SendActionsQueue.create(action => connectionWithParent.send('scheduled-action', action))

		renderCancelCallback?.()
		renderCancelCallback = startRenderingGame(canvas, decodedGame, decodedUpdater, queue, camera)
	}
}
