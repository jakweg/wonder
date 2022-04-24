import { startRenderingGame } from '../3d-stuff/renderable/render-context'
import { Camera } from '../camera'
import { createGameStateForRenderer, GameState } from '../game-state/game-state'
import { ActionsQueue, SendActionsQueue } from '../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../util/frontend-variables-updaters'
import { setMessageHandler } from '../worker/message-handler'
import SettingsContainer from '../worker/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../worker/serializable-settings'
import { WorkerController } from '../worker/worker-controller'
import { globalMutex } from '../worker/global-mutex'
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

	args['settings'].observeEverything(snapshot => updateWorker.replier.send('new-settings', snapshot))

	setMessageHandler('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
	})

	setMessageHandler('save-game-result', data => {
		args['saveResultsCallback'](data)
	})

	const queue: ActionsQueue = SendActionsQueue.create(a => updateWorker.replier.send('scheduled-action', a))

	setMessageHandler('game-snapshot-for-renderer', (data) => {
		decodedGame = createGameStateForRenderer(data['game'])

		updater = createStateUpdaterControllerFromReceived(data['updater'])
		gameResolveCallback({'state': decodedGame, 'updater': updater, 'queue': queue})
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
			renderingCancelCallback?.()
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			const gameTickEstimation = () => updater!.estimateCurrentGameTickTime(updateWorker.workerStartDelay)
			renderingCancelCallback = startRenderingGame(args['canvas'], decodedGame, updater!, queue!, camera, gameTickEstimation)
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
