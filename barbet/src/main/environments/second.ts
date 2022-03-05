import { GameState } from '../3d-stuff/game-state/game-state'
import { StateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { frontedVariablesBuffer } from '../util/frontend-variables'
import { setMessageHandler } from '../worker/message-handler'
import { WorkerController } from '../worker/worker-controller'
import { globalMutex } from '../worker/worker-global-state'
import { EnvironmentConnection, StartRenderArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = (): EnvironmentConnection => {
	let gameSnapshotForRenderer: any = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	let updateWorker: WorkerController | null = null
	let renderWorker: WorkerController | null = null

	return {
		name: 'zero',
		async createNewGame() {
			if (updateWorker !== null)
				throw new Error('Game was already created')

			updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
			updateWorker.replier.send('create-game', undefined)

			return await new Promise(resolve => {
				setMessageHandler('game-snapshot-for-renderer', (data) => {
					gameSnapshotForRenderer = data

					decodedGame = GameState.forRenderer(data.game)
					updater = stateUpdaterFromReceived(globalMutex, data.updater)

					resolve({state: decodedGame, updater})
				})
			})
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			if (renderWorker !== null)
				throw new Error('Render worker was already created')

			if (gameSnapshotForRenderer === null)
				throw new Error('Create game first')

			renderWorker = await WorkerController.spawnNew('render-worker', 'render', globalMutex)
			const canvasControl = (args.canvas as any).transferControlToOffscreen()
			renderWorker.replier.send('frontend-variables', {buffer: frontedVariablesBuffer})
			renderWorker.replier.send('transfer-canvas', {canvas: canvasControl}, [canvasControl])
			renderWorker.replier.send('game-snapshot-for-renderer', gameSnapshotForRenderer)
		},
	}
}

