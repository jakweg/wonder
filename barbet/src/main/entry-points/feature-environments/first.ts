import { Camera } from '../../3d-stuff/camera'
import { startRenderingGame } from '../../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../../game-state/game-state'
import { ActionsQueue, SendActionsQueue } from '../../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { TickQueueAction } from '../../network/tick-queue-action'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { globalMutex, setGlobalMutex } from '../../util/worker/global-mutex'
import { spawnNew as spawnNewUpdateWorker } from '../../util/worker/message-types/update'
import {
	ConnectArguments,
	EnvironmentConnection,
	SaveGameArguments,
	StartRenderArguments,
	TerminateGameArguments
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
	const updateWorker = await spawnNewUpdateWorker(globalMutex)

	CONFIG.observeEverything(snapshot => updateWorker.send.send('new-settings', snapshot))

	updateWorker.receive.on('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
	})

	updateWorker.receive.on('feedback', data => {
		args.feedbackCallback(data)
	})

	const queue: ActionsQueue = SendActionsQueue.create(a => args.feedbackCallback({ type: 'input-action', value: a }))

	updateWorker.receive.on('game-create-result', (data) => {
		decodedGame = createGameStateForRenderer(data.game)

		updater = createStateUpdaterControllerFromReceived(data.updater)
		gameResolveCallback({
			state: decodedGame,
			updater,
			setActionsCallback: (forTick: number, playerId: number, actions: TickQueueAction[]) => {
				updateWorker.send.send('append-to-tick-queue', { forTick, playerId, actions })
			},
		})
	})


	const terminate = (args: TerminateGameArguments) => {
		updateWorker.send.send('terminate-game', args)
		renderingCancelCallback?.()
		renderingCancelCallback = decodedGame = updater = null

		if (args.terminateEverything)
			setTimeout(() => updateWorker.terminate(), 10_000)
	}

	return {
		name: 'first',
		async createNewGame(gameArgs) {
			if (decodedGame !== null) {
				terminate({})
			}

			updateWorker.send.send('create-game', gameArgs)
			return await new Promise(resolve => gameResolveCallback = resolve)
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			if (decodedGame === null) throw new Error('Start game first')
			renderingCancelCallback?.()
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			const gameTickEstimation = () => updater!.estimateCurrentGameTickTime(updateWorker.startDelay)
			renderingCancelCallback = startRenderingGame(args.canvas, decodedGame, updater!, queue!, camera, gameTickEstimation)
		},
		saveGame(args: SaveGameArguments): void {
			updateWorker?.send?.send('save-game', args)
		},
		terminate,
	}
}
