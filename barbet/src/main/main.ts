import { GameState } from './3d-stuff/game-state/game-state'
import { createNewStateUpdater, StateUpdater, stateUpdaterFromReceived } from './3d-stuff/game-state/state-updater'
import { startRenderingGame } from './3d-stuff/renderable/render-context'
import {
	bindFrontendVariablesToCanvas,
	frontedVariablesBuffer,
	initFrontendVariableAndRegisterToWindow,
} from './util/frontend-variables'
import { sharedMemoryIsAvailable } from './util/shared-memory'
import { createEmptyGame } from './worker/example-state-creator'
import { setMessageHandler } from './worker/message-handler'
import { WorkerController } from './worker/worker-controller'
import { globalMutex, globalWorkerDelay, setGlobalGameState, setGlobalStateUpdater } from './worker/worker-global-state'

initFrontendVariableAndRegisterToWindow()

const canvas: HTMLCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement

bindFrontendVariablesToCanvas(canvas)

let updater: StateUpdater | null = null
const ticksInput = document.getElementById('input-ticksPerSecond') as HTMLInputElement
let speedToSet = +ticksInput.value
ticksInput.addEventListener('input', async (event) => {
	speedToSet = +(event.target as HTMLInputElement).value
	updater?.changeTickRate(speedToSet)
})


async function startDoubleWorkerGame() {
	const renderWorker = await WorkerController.spawnNew('render-worker', 'render', globalMutex)
	const canvasControl = (canvas as any).transferControlToOffscreen()
	renderWorker.replier.send('transfer-canvas', {canvas: canvasControl}, [canvasControl])

	const updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
	updateWorker.replier.send('create-game', undefined)

	setMessageHandler('game-snapshot-for-renderer', (data) => {
		updater = stateUpdaterFromReceived(globalMutex, data.updater)
		renderWorker.replier.send('game-snapshot-for-renderer', data)
		updater.changeTickRate(speedToSet)
		updater.start(speedToSet)
	})

	renderWorker.replier.send('set-worker-load-delays', {
		render: renderWorker.workerStartDelay,
		update: updateWorker.workerStartDelay,
	})
	renderWorker.replier.send('frontend-variables', {buffer: frontedVariablesBuffer})
}

async function startSingleWorkerGame() {
	let decodedGame: GameState | null = null

	const updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
	updateWorker.replier.send('create-game', undefined)
	globalWorkerDelay.difference = updateWorker.workerStartDelay


	setMessageHandler('game-snapshot-for-renderer', (data) => {
		decodedGame = GameState.forRenderer(data.game)

		updater = stateUpdaterFromReceived(globalMutex, data.updater)
		updater.changeTickRate(speedToSet)

		startRenderingGame(canvas, decodedGame, updater)
		updater.start(speedToSet)
	})
}

function startZeroWorkerGame() {
	const game = createEmptyGame()
	setGlobalGameState(game)

	const updaterInstance = createNewStateUpdater(globalMutex, game)
	setGlobalStateUpdater(updaterInstance)

	updater = stateUpdaterFromReceived(globalMutex, updaterInstance.pass())
	startRenderingGame(canvas, game, updater)
	updater.start(speedToSet)
}

(async () => {
	if (sharedMemoryIsAvailable) {
		const offscreenCanvasIsAvailable = !!((window as any).OffscreenCanvas)
		if (offscreenCanvasIsAvailable)
			await startDoubleWorkerGame()
		else {
			console.warn('Offscreen rendering is not available')
			await startSingleWorkerGame()
		}
	} else {
		console.warn('Shared memory is not available')
		startZeroWorkerGame()
	}
})()
