import { GameStateImplementation } from '../game-state/game-state'
import { createNewStateUpdater } from '../game-state/state-updater'
import { StateUpdaterImplementation } from '../game-state/state-updater/implementation'
import { loadGameFromArgs } from '../game-state/world/world-loader'
import { performGameSave } from '../game-state/world/world-saver'
import TickQueue from '../network/tick-queue'
import { gameMutexFrom } from '../util/game-mutex'
import CONFIG from '../util/persistance/observable-settings'
import { FramesMeter } from '../util/worker/debug-stats/frames-meter'
import { UpdateDebugDataCollector } from '../util/worker/debug-stats/update'
import { bind, FromWorker, ToWorker } from '../util/worker/message-types/update'

const { sender, receiver } = await bind()
const mutex = gameMutexFrom(await receiver.await(ToWorker.GameMutex))

const stats = new UpdateDebugDataCollector(new FramesMeter(180))
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

	gameState = await loadGameFromArgs(args, stats, mutex, stateBroadcastCallback) as GameStateImplementation

	tickQueue = TickQueue.createEmpty()

	stateUpdater = createNewStateUpdater(
		async (gameActions, updaterActions) => {

			await gameState!.advanceActivities(gameActions, stats)

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

let timeoutId: ReturnType<typeof setTimeout>
CONFIG.observe('debug/show-info', show => {
	if (show) {
		stats.receiveUpdates((data) => {
			clearTimeout(timeoutId)
			timeoutId = setTimeout(() => void sender.send(FromWorker.DebugStatsUpdate, data), 0);
		})
	} else stats.stopUpdates()
})
