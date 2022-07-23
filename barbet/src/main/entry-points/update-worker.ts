import { GameStateImplementation } from '../game-state/game-state'
import { createNewStateUpdater } from '../game-state/state-updater'
import { StateUpdaterImplementation } from '../game-state/state-updater/implementation'
import { loadGameFromArgs } from '../game-state/world/world-loader'
import { performGameSave } from '../game-state/world/world-saver'
import TickQueue from '../network2/tick-queue'
import CONFIG from '../util/persistance/observable-settings'
import { bind } from '../util/worker/message-types/update'

const { sender, receiver } = await bind()


let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let tickQueue: TickQueue | null = null

receiver.on('new-settings', settings => {
	CONFIG.update(settings)
})

receiver.on('terminate-game', args => {
	stateUpdater?.terminate()
	gameState = stateUpdater = null
	if (args.terminateEverything)
		close()
})

receiver.on('create-game', async (args) => {
	const stateBroadcastCallback = () => {
		if (gameState === null) return
		sender.send('update-entity-container', {
			buffers: gameState?.entities?.passBuffers(),
		})
	}

	gameState = await loadGameFromArgs(args, stateBroadcastCallback) as GameStateImplementation

	tickQueue = TickQueue.createEmpty()

	stateUpdater = createNewStateUpdater(
		async (gameActions, updaterActions) => {

			await gameState!.advanceActivities(gameActions)

			const currentTick = gameState!.currentTick

			sender.send('tick-completed', { tick: currentTick, updaterActions })
		},
		gameState.currentTick, tickQueue)

	sender.send('game-create-result', {
		game: gameState!.passForRenderer(),
		updater: stateUpdater!.pass(),
	})
})

receiver.on('save-game', async (data) => {
	const result = gameState ? (await performGameSave(gameState, data)) : false
	sender.send('game-saved', result)
})

receiver.on('append-to-tick-queue', ({ actions, playerId, forTick }) => {
	tickQueue?.setForTick(forTick, playerId, actions)
})

receiver.on('set-player-ids', ({ playerIds }) => {
	tickQueue?.setRequiredPlayers(playerIds)
})