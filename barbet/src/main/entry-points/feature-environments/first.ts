import { Camera } from '../../3d-stuff/camera'
import { startRenderingGame } from '../../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../../game-state/game-state'
import { ActionsQueue, SendActionsQueue } from '../../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { SaveGameArguments, SaveGameResult } from '../../game-state/world/world-saver'
import { TickQueueAction } from '../../network2/tick-queue-action'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { globalMutex, setGlobalMutex } from '../../util/worker/global-mutex'
import { spawnNew as spawnNewUpdateWorker } from '../../util/worker/message-types/update'
import {
	ConnectArguments,
	EnvironmentConnection,
	GameListeners,
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
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	let listeners: GameListeners | null = null
	const updateWorker = await spawnNewUpdateWorker(globalMutex)

	CONFIG.observeEverything(snapshot => updateWorker.send.send('new-settings', snapshot))

	updateWorker.receive.on('update-entity-container', data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
	})

	updateWorker.receive.on('tick-completed', data => {
		listeners?.onTickCompleted(data.tick)
	})

	const queue: ActionsQueue = SendActionsQueue.create(a => listeners?.onInputCaused(a))


	const terminate = (args: TerminateGameArguments) => {
		updateWorker.send.send('terminate-game', args)
		renderingCancelCallback?.()
		listeners = renderingCancelCallback = decodedGame = updater = null

		if (args.terminateEverything)
			setTimeout(() => updateWorker.terminate(), 10_000)
	}

	return {
		name: 'first',
		async createNewGame(gameArgs) {
			if (decodedGame !== null)
				terminate({})

			updateWorker.send.send('create-game', gameArgs)

			const data = await updateWorker.receive.await('game-create-result')

			decodedGame = createGameStateForRenderer(data.game)
			updater = createStateUpdaterControllerFromReceived(data.updater)

			return {
				state: decodedGame,
				updater,
				setActionsCallback(forTick: number, playerId: string, actions: TickQueueAction[]) {
					updateWorker.send.send('append-to-tick-queue', { forTick, playerId, actions })
				},
				setPlayerIdsCallback(ids) {
					updateWorker.send.send('set-player-ids', { playerIds: ids })
				},
				setGameListeners(l) {
					listeners = l
				},
			}
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			if (decodedGame === null) throw new Error('Start game first')
			renderingCancelCallback?.()
			const camera = Camera.newUsingBuffer(getCameraBuffer())
			const gameTickEstimation = () => updater!.estimateCurrentGameTickTime(updateWorker.startDelay)
			renderingCancelCallback = startRenderingGame(args.canvas, decodedGame, updater!, queue!, camera, gameTickEstimation)
		},
		async saveGame(args: SaveGameArguments): Promise<SaveGameResult> {
			if (updateWorker) {
				updateWorker.send.send('save-game', args)
				const result = await updateWorker.receive.await('game-saved')
				if (result !== false)
					return result
			}
			throw new Error('save failed')
		},
		terminate,
	}
}
