import { Camera } from '../../3d-stuff/camera'
import { startRenderingGame } from '../../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../../game-state/game-state'
import { ActionsQueue, SendActionsQueue } from '../../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { globalMutex, setGlobalMutex } from '../../util/worker/global-mutex'
import { WorkerController } from '../../util/worker/worker-controller'
import {
	ConnectArguments,
	EnvironmentConnection,
	SaveGameArguments,
	StartRenderArguments,
	TerminateGameArguments,
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = async (args: ConnectArguments): Promise<EnvironmentConnection> => {
	setGlobalMutex(args.mutex.pass())
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	args.settings.observeEverything(s => CONFIG.replace(s))

	let renderingCancelCallback: any = null
	let gameResolveCallback: any = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	const updateWorker = await WorkerController.spawnNew('update-worker', 'update', globalMutex)

	CONFIG.observeEverything(snapshot => updateWorker.replier.send('new-settings', snapshot))

	updateWorker.handler.listen('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
	})

	updateWorker.handler.listen('feedback', data => {
		args.feedbackCallback(data)
	})
	updateWorker.handler.listen('feedback', data => {
		args.feedbackCallback(data)
	})

	const queue: ActionsQueue = SendActionsQueue.create(a => updateWorker.replier.send('scheduled-action', a))

	updateWorker.handler.listen('game-snapshot-for-renderer', (data) => {
		decodedGame = createGameStateForRenderer(data.game)

		updater = createStateUpdaterControllerFromReceived(data.updater)
		gameResolveCallback({state: decodedGame, updater, queue})
	})


	return {
		name: 'first',
		async createNewGame(gameArgs) {
			if (decodedGame !== null)
				throw new Error('Game was already created')

			updateWorker.replier.send('create-game', gameArgs)
			return await new Promise(resolve => gameResolveCallback = resolve)
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			if (decodedGame === null) throw new Error('Start game first')
			renderingCancelCallback?.()
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			const gameTickEstimation = () => updater!.estimateCurrentGameTickTime(updateWorker.workerStartDelay)
			renderingCancelCallback = startRenderingGame(args.canvas, decodedGame, updater!, queue!, camera, gameTickEstimation)
		},
		saveGame(args: SaveGameArguments): void {
			updateWorker.replier?.send('save-game', args)
		},
		terminateGame(args: TerminateGameArguments) {
			updateWorker.replier.send('terminate-game', args)
			renderingCancelCallback?.()
			renderingCancelCallback = decodedGame = updater = null
		},
	}
}
