import { Camera } from '../3d-stuff/camera'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../game-state/game-state'
import { SendActionsQueue } from '../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import CONFIG from '../util/persistance/observable-settings'
import { bind } from '../util/worker/message-types/render'

const { sender, receiver } = await bind()

let renderCancelCallback: () => void = () => void 0
let workerStartDelayDifference = 0
let canvas: HTMLCanvasElement | null = null
let gameSnapshot: unknown | null = null
let decodedGame: GameState | null = null
let decodedUpdater: StateUpdater | null = null
let cameraBuffer: SharedArrayBuffer | null = null

receiver.on('new-settings', settings => {
	CONFIG.update(settings)
})

receiver.on('transfer-canvas', (data) => {
	canvas = data.canvas as HTMLCanvasElement
	considerStartRendering()
})

receiver.on('set-worker-load-delays', (data) => {
	workerStartDelayDifference = data.update - data.render
})

receiver.on('game-create-result', (data) => {
	gameSnapshot = data
	considerStartRendering()
})

receiver.on('update-entity-container', (data) => {
	decodedGame!.entities.replaceBuffersFromReceived(data)
})

receiver.on('camera-buffer', (data) => {
	cameraBuffer = data.buffer
})

receiver.on('frontend-variables', (data) => {
	initFrontedVariablesFromReceived(data.buffer)
})

receiver.on('terminate-game', args => {
	renderCancelCallback?.()
	canvas = decodedUpdater = decodedGame = gameSnapshot = null
	if (args.terminateEverything)
		close()
})


const considerStartRendering = () => {
	if (decodedGame === null && gameSnapshot !== null) {
		const snapshot = gameSnapshot as any
		decodedGame = createGameStateForRenderer(snapshot.game)
		decodedUpdater = createStateUpdaterControllerFromReceived(snapshot.updater)
	}

	if (canvas !== null && decodedGame !== null && decodedUpdater !== null) {
		const camera = cameraBuffer ? Camera.newUsingBuffer(cameraBuffer) : Camera.newPerspective()

		const queue = SendActionsQueue.create(action => sender.send('scheduled-action', action))

		renderCancelCallback?.()
		const gameTickEstimation = () => decodedUpdater!.estimateCurrentGameTickTime(workerStartDelayDifference)
		renderCancelCallback = startRenderingGame(canvas, decodedGame, decodedUpdater, queue, camera, gameTickEstimation)
	}
}
