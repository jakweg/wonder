import { GameState } from '../3d-stuff/game-state/game-state'
import { StateUpdater, stateUpdaterFromReceived } from '../3d-stuff/game-state/state-updater'
import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { setMessageHandler } from '../worker/message-handler'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { WorkerController } from '../worker/worker-controller'
import { globalMutex, globalWorkerDelay } from '../worker/worker-global-state'
import { ConnectArguments, EnvironmentConnection, SaveGameArguments, StartRenderArguments } from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = (args: ConnectArguments): EnvironmentConnection => {
	initFrontedVariablesFromReceived(args['frontendVariables'])
	setCameraBuffer(args['camera'])
	SettingsContainer.INSTANCE = args['settings']

	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	let updateWorker: WorkerController | null = null

	return {
		'name': 'first',
		async 'createNewGame'(gameArgs) {
			if (updateWorker !== null)
				throw new Error('Game was already created')

			updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)
			args['settings'].observeEverything(snapshot => updateWorker?.replier.send('new-settings', snapshot))

			updateWorker.replier.send('create-game', {'saveName': gameArgs['saveName']})
			globalWorkerDelay.difference = updateWorker.workerStartDelay

			setMessageHandler('update-entity-container', data => {
				decodedGame!.entities.replaceBuffersFromReceived(data)
			})

			return await new Promise(resolve => {
				setMessageHandler('game-snapshot-for-renderer', (data) => {
					decodedGame = GameState.forRenderer(data['game'])

					updater = stateUpdaterFromReceived(globalMutex, data['updater'])
					resolve({'state': decodedGame, 'updater': updater})
				})
			})
		},
		async 'startRender'(args: StartRenderArguments): Promise<void> {
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			startRenderingGame(args['canvas'], args['game'], args['updater'], camera)
		},
		'saveGame'(args: SaveGameArguments): void {
			updateWorker?.replier?.send('save-game', {'saveName': args['saveName']})
		},
	}
}
