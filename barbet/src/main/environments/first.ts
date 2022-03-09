import { GameState } from '../3d-stuff/game-state/game-state'
import { StateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables'
import { setMessageHandler } from '../worker/message-handler'
import { getCameraBuffer } from '../worker/serializable-settings'
import { WorkerController } from '../worker/worker-controller'
import { globalMutex, globalWorkerDelay } from '../worker/worker-global-state'
import { EnvironmentConnection, StartRenderArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = ({frontendVariables}: { frontendVariables: SharedArrayBuffer }): EnvironmentConnection => {
	initFrontedVariablesFromReceived(frontendVariables)

	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	let updateWorker: WorkerController | null = null

	return {
		name: 'zero',
		async createNewGame() {
			if (updateWorker !== null)
				throw new Error('Game was already created')

			updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
			updateWorker.replier.send('create-game', undefined)
			globalWorkerDelay.difference = updateWorker.workerStartDelay

			setMessageHandler('update-entity-container', data => {
				decodedGame!.entities.replaceBuffersFromReceived(data)
			})

			return await new Promise(resolve => {
				setMessageHandler('game-snapshot-for-renderer', (data) => {
					decodedGame = GameState.forRenderer(data.game)

					updater = stateUpdaterFromReceived(globalMutex, data.updater)
					resolve({state: decodedGame, updater})
				})
			})
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			startRenderingGame(args.canvas, args.game, args.updater, camera)
		},
	}
}

