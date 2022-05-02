import { GameStateImplementation } from './game-state/game-state'
import { ReceiveActionsQueue } from './game-state/scheduled-actions/queue'
import { createNewStateUpdater } from './game-state/state-updater'
import { StateUpdaterImplementation } from './game-state/state-updater/implementation'
import TickQueue from './network/tick-queue'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setGlobalMutex } from './worker/global-mutex'
import { setMessageHandler } from './worker/message-handler'
import CONFIG from './worker/observable-settings'
import { loadGameFromArgs } from './worker/world-loader'
import { performGameSave } from './worker/world-saver'

takeControlOverWorkerConnection()


let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let actionsQueue: ReceiveActionsQueue | null = null
let tickQueue: TickQueue | null = null

setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})

setMessageHandler('new-settings', settings => {
	CONFIG.update(settings)
})

setMessageHandler('terminate-game', () => {
	stateUpdater?.terminate()
	gameState = stateUpdater = actionsQueue = null
})

setMessageHandler('create-game', async (args, connection) => {
	const stateBroadcastCallback = () => {
		if (gameState === null) return
		connection.send('update-entity-container', {
			buffers: gameState?.entities?.passBuffers(),
		})
	}

	actionsQueue = ReceiveActionsQueue.create()

	gameState = await loadGameFromArgs(args, actionsQueue!, stateBroadcastCallback) as GameStateImplementation

	tickQueue = TickQueue.createEmpty()
	stateUpdater = createNewStateUpdater(
		async (gameActions, updaterActions) => {

			await gameState!.advanceActivities(gameActions)

			connection.send('feedback', {type: 'tick-completed', tick: gameState!.currentTick, updaterActions})
		},
		gameState.currentTick, tickQueue)

	connection.send('game-snapshot-for-renderer', {
		game: gameState!.passForRenderer(),
		updater: stateUpdater!.pass(),
	})
})

setMessageHandler('save-game', async (data, connection) => {
	performGameSave(gameState, data, value => connection.send('feedback', value))
})

// setMessageHandler('scheduled-action', (action) => {
// 	actionsQueue?.append(action)
// })

setMessageHandler('append-to-tick-queue', ({actions, forTick}) => {
	tickQueue?.setForTick(forTick, actions)
})
