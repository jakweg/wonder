import { Camera } from '../../3d-stuff/camera'
import { createRenderingSession } from '../../3d-stuff/renderable/render-context'
import { GameStateImplementation } from '../../game-state/game-state'
import { ActionsQueue, SendActionsQueue } from '../../game-state/scheduled-actions/queue'
import {
	createNewStateUpdater,
	createStateUpdaterControllerFromReceived,
	StateUpdater
} from '../../game-state/state-updater'
import { loadGameFromArgs } from '../../game-state/world/world-loader'
import { performGameSave, SaveGameArguments, SaveGameResult } from '../../game-state/world/world-saver'
import TickQueue from '../../network/tick-queue'
import { TickQueueAction } from '../../network/tick-queue-action'
import { initFrontedVariablesFromReceived } from '../../util/frontend-variables-updaters'
import { createNewGameMutex } from '../../util/game-mutex'
import CONFIG from '../../util/persistance/observable-settings'
import { getCameraBuffer, setCameraBuffer } from '../../util/persistance/serializable-settings'
import { newStatsObject as newRenderStatsObject } from '../../util/worker/debug-stats/render'
import { newStatsObject as newUpdateStatsObject } from '../../util/worker/debug-stats/update'
import {
	ConnectArguments,
	CreateGameArguments,
	CreateGameResult,
	EnvironmentConnection,
	GameListeners,
	StartRenderArguments,
	TerminateGameArguments
} from './loader'

// this function is always used
// noinspection JSUnusedGlobalSymbols
export const bind = (args: ConnectArguments): EnvironmentConnection => {
	initFrontedVariablesFromReceived(args.frontendVariables)
	setCameraBuffer(args.camera)
	args.settings.observeEverything(s => CONFIG.replace(s))

	let session: Awaited<ReturnType<typeof createRenderingSession>> | null = null
	let tickQueue: TickQueue | null = null
	let actionsQueue: ActionsQueue | null = null
	let game: GameStateImplementation | null = null
	let updater: StateUpdater | null = null
	let gameListeners: GameListeners | null = null

	const renderDebugStats = newRenderStatsObject()
	const updateDebugStats = newUpdateStatsObject()
	return {
		name: 'zero',
		async createNewGame(gameArgs: CreateGameArguments): Promise<CreateGameResult> {
			if (game !== null)
				this.terminate({})

			const mutex = createNewGameMutex()
			const stateBroadcastCallback = () => void 0 // ignore, since everything is locally anyway
			actionsQueue = SendActionsQueue.create(action => {
				gameListeners?.onInputCaused(action)
			})

			const pendingSession = createRenderingSession(actionsQueue, mutex)

			game = await loadGameFromArgs(gameArgs, mutex, stateBroadcastCallback) as GameStateImplementation

			session = await pendingSession
			let timeoutId: ReturnType<typeof setTimeout>
			CONFIG.observe('other/show-debug-info', show => {
				if (show) {
					session!.stats.receiveUpdates((data) => {
						clearTimeout(timeoutId)
						timeoutId = setTimeout(() => renderDebugStats.replaceFromArray(data), 0);
					})
				} else session!.stats.stopUpdates()
			})


			tickQueue = TickQueue.createEmpty()


			const updaterInstance = createNewStateUpdater(
				async (gameActions) => {
					await game!.advanceActivities(gameActions)
					const currentTick = game!.currentTick
					gameListeners?.onTickCompleted(currentTick)
				},
				game.currentTick, tickQueue)


			updater = createStateUpdaterControllerFromReceived(updaterInstance.pass())
			session.setGame(game, () => updater!.estimateCurrentGameTickTime(0), () => updater!.getTickRate())
			return {
				renderDebugStats,
				updateDebugStats,
				updater,
				setActionsCallback: (forTick: number, playerId: string, actions: TickQueueAction[]) => {
					tickQueue!.setForTick(forTick, playerId, actions)
				},
				setPlayerIdsCallback(ids) {
					tickQueue?.setRequiredPlayers(ids)
				},
				setGameListeners(l) {
					gameListeners = l
				},
			}
		},
		async startRender(args: StartRenderArguments): Promise<void> {
			if (game === null) throw new Error('Start game first')
			if (!session) return

			session!.setCamera(Camera.newUsingBuffer(getCameraBuffer()))
			session!.setCanvas(args.canvas)
		},
		terminate(_: TerminateGameArguments) {
			session?.cleanUp()
			updater?.stop()
			gameListeners = actionsQueue = game = updater = null
		},
		async saveGame(saveArgs: SaveGameArguments): Promise<SaveGameResult> {
			const result = game ? (await performGameSave(game, saveArgs)) : false
			if (result === false)
				throw new Error()
			return result
		},
	}
}

