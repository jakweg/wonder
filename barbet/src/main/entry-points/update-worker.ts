import { measureMillisecondsAsync } from '@seampan/util'
import { GameStateImplementation } from '../game-state/game-state'
import { createNewStateUpdater } from '../game-state/state-updater'
import { StateUpdaterImplementation } from '../game-state/state-updater/implementation'
import { loadGameFromArgs } from '../game-state/world/world-loader'
import { performGameSave } from '../game-state/world/world-saver'
import TickQueue from '../network/tick-queue'
import { gameMutexFrom } from '../util/game-mutex'
import CONFIG from '../util/persistance/observable-settings'
import { UpdateDebugDataCollector } from '../util/worker/debug-stats/update'
import { bind, FromWorker, ToWorker } from '../util/worker/message-types/update'

const { sender, receiver } = await bind()
const mutex = gameMutexFrom(await receiver.await(ToWorker.GameMutex))

const stats = new UpdateDebugDataCollector()
let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let tickQueue: TickQueue | null = null

receiver.on(ToWorker.NewSettings, settings => {
	CONFIG.update(settings)
})

receiver.on(ToWorker.TerminateGame, args => {
	stateUpdater?.terminate()
	gameState = stateUpdater = null
	if (args.terminateEverything)
		close()
})

receiver.on(ToWorker.CreateGame, async (args) => {
	const stateBroadcastCallback = () => {
		if (gameState === null) return
		sender.send(FromWorker.UpdateEntityContainer, {
			buffers: gameState?.entities?.passBuffers(),
		})
	}

	let loadingMs = 0;
	[gameState, loadingMs] = await measureMillisecondsAsync(async () => await loadGameFromArgs(args, mutex, stateBroadcastCallback) as GameStateImplementation)
	stats.setLoadingGameTime(loadingMs)

	tickQueue = TickQueue.createEmpty()

	stateUpdater = createNewStateUpdater(
		async (gameActions, updaterActions) => {

			await gameState!.advanceActivities(gameActions)

			const currentTick = gameState!.currentTick

			sender.send(FromWorker.TickCompleted, { tick: currentTick, updaterActions })
		},
		gameState.currentTick, tickQueue)

	sender.send(FromWorker.GameCreateResult, {
		game: gameState!.passForRenderer(),
		updater: stateUpdater!.pass(),
	})
})

receiver.on(ToWorker.SaveGame, async (data) => {
	const result = gameState ? (await performGameSave(gameState, data)) : false
	sender.send(FromWorker.GameSaved, result)
})

receiver.on(ToWorker.AppendToTickQueue, ({ actions, playerId, forTick }) => {
	tickQueue?.setForTick(forTick, playerId, actions)
})

receiver.on(ToWorker.SetPlayerIds, ({ playerIds }) => {
	tickQueue?.setRequiredPlayers(playerIds)
})

CONFIG.observe('other/show-debug-info', show => {
	if (show) {
		stats.receiveUpdates((data) => {
			sender.send(FromWorker.DebugStatsUpdate, data)
		})
	} else stats.stopUpdates()
})
