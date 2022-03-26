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
import {
	ConnectArguments,
	EnvironmentConnection,
	SaveGameArguments,
	StartRenderArguments,
	TerminateGameArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const connect = async (args: ConnectArguments): Promise<EnvironmentConnection> => {
	initFrontedVariablesFromReceived(args['frontendVariables'])
	setCameraBuffer(args['camera'])
	SettingsContainer.INSTANCE = args['settings']

	let renderingCancelCallback: any = null
	let gameResolveCallback: any = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	const updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)

	globalWorkerDelay.difference = updateWorker.workerStartDelay
	args['settings'].observeEverything(snapshot => updateWorker.replier.send('new-settings', snapshot))

	setMessageHandler('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
	})

	setMessageHandler('save-game-result', data => {
		args['saveResultsCallback'](data)
	})

	setMessageHandler('game-snapshot-for-renderer', (data) => {
		decodedGame = GameState.forRenderer(data['game'])

		updater = stateUpdaterFromReceived(globalMutex, data['updater'])
		gameResolveCallback({'state': decodedGame, 'updater': updater})
	})

	return {
		'name': 'first',
		async 'createNewGame'(gameArgs) {
			if (decodedGame !== null)
				throw new Error('Game was already created')

			updateWorker.replier.send('create-game', gameArgs)
			return await new Promise(resolve => gameResolveCallback = resolve)
		},
		async 'startRender'(args: StartRenderArguments): Promise<void> {
			if (decodedGame === null) throw new Error('Start game first')
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			renderingCancelCallback = startRenderingGame(args['canvas'], decodedGame, updater!, camera)
		},
		'saveGame'(args: SaveGameArguments): void {
			updateWorker.replier?.send('save-game', args)
		},
		'terminateGame'(args: TerminateGameArguments) {
			updateWorker.replier.send('terminate-game', args)
			renderingCancelCallback?.()
			renderingCancelCallback = decodedGame = updater = null
		},
	}
}
