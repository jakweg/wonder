import { Camera } from '../../3d-stuff/camera'
import { startRenderingGame } from '../../3d-stuff/renderable/render-context'
import { createGameStateForRenderer, GameState } from '../../game-state/game-state'
import { ActionsQueue, SendActionsQueue } from '../../game-state/scheduled-actions/queue'
import { createStateUpdaterControllerFromReceived, StateUpdater } from '../../game-state/state-updater'
import { SaveGameArguments, SaveGameResult } from '../../game-state/world/world-saver'
import { TickQueueAction } from '../../network/tick-queue-action'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { FromWorker as FromUpdate, spawnNew as spawnNewUpdateWorker, ToWorker as ToUpdate } from '../../util/worker/message-types/update'
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
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	args.settings.observeEverything(s => CONFIG.replace(s))

	let renderingCancelCallback: any = null
	let decodedGame: GameState | null = null
	let updater: StateUpdater | null = null
	let listeners: GameListeners | null = null
	const updateWorker = await spawnNewUpdateWorker()

	CONFIG.observeEverything(snapshot => updateWorker.send.send(ToUpdate.NewSettings, snapshot))

	updateWorker.receive.on(FromUpdate.UpdateEntityContainer, data => {
		decodedGame!.entities.replaceBuffersFromReceived(data)
	})

	updateWorker.receive.on(FromUpdate.TickCompleted, data => {
		listeners?.onTickCompleted(data.tick)
	})

	const queue: ActionsQueue = SendActionsQueue.create(a => listeners?.onInputCaused(a))


	const terminate = (args: TerminateGameArguments) => {
		updateWorker.send.send(ToUpdate.TerminateGame, args)
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

			updateWorker.send.send(ToUpdate.CreateGame, gameArgs)

			const data = await updateWorker.receive.await(FromUpdate.GameCreateResult)

			decodedGame = createGameStateForRenderer(data.game)
			updater = createStateUpdaterControllerFromReceived(data.updater)

			return {
				updater,
				setActionsCallback(forTick: number, playerId: string, actions: TickQueueAction[]) {
					updateWorker.send.send(ToUpdate.AppendToTickQueue, { forTick, playerId, actions })
				},
				setPlayerIdsCallback(ids) {
					updateWorker.send.send(ToUpdate.SetPlayerIds, { playerIds: ids })
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
				updateWorker.send.send(ToUpdate.SaveGame, args)
				const result = await updateWorker.receive.await(FromUpdate.GameSaved)
				if (result !== false)
					return result
			}
			throw new Error('save failed')
		},
		terminate,
	}
}
