import { GameStateImplementation } from '../game-state/game-state'
import { createNewStateUpdater } from '../game-state/state-updater'
import { StateUpdaterImplementation } from '../game-state/state-updater/implementation'
import { loadGameFromArgs } from '../game-state/world/world-loader'
import { performGameSave } from '../game-state/world/world-saver'
import TickQueue from '../network/tick-queue'
import CONFIG from '../util/persistance/observable-settings'
import { takeControlOverWorkerConnection } from '../util/worker/connections-manager'
import { setGlobalMutex } from '../util/worker/global-mutex'

const connectionWithParent = takeControlOverWorkerConnection()


let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let tickQueue: TickQueue | null = null

connectionWithParent.listen('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})

connectionWithParent.listen('new-settings', settings => {
	CONFIG.update(settings)
})

connectionWithParent.listen('terminate-game', () => {
	stateUpdater?.terminate()
	gameState = stateUpdater = null
})

connectionWithParent.listen('create-game', async (args) => {
	const stateBroadcastCallback = () => {
		if (gameState === null) return
		connectionWithParent.send('update-entity-container', {
			buffers: gameState?.entities?.passBuffers(),
		})
	}

	gameState = await loadGameFromArgs(args, stateBroadcastCallback) as GameStateImplementation

	tickQueue = TickQueue.createEmpty()

	if (args.existingInputActorIds)
		args.existingInputActorIds.forEach(id => tickQueue!.addRequiredPlayer(id, 0))

	stateUpdater = createNewStateUpdater(
		async (gameActions, updaterActions) => {

			await gameState!.advanceActivities(gameActions)

			const currentTick = gameState!.currentTick
			for (const a of updaterActions) {
				if (a.type === 'new-player-joins') {
					tickQueue!.addRequiredPlayer(a.playerId, currentTick)
				}
			}

			connectionWithParent.send('feedback', {type: 'tick-completed', tick: currentTick, updaterActions})
		},
		gameState.currentTick, tickQueue)

	connectionWithParent.send('game-snapshot-for-renderer', {
		game: gameState!.passForRenderer(),
		updater: stateUpdater!.pass(),
	})
})

connectionWithParent.listen('save-game', async (data) => {
	performGameSave(gameState, data, value => connectionWithParent.send('feedback', value), tickQueue!.getActorIds())
})

connectionWithParent.listen('append-to-tick-queue', ({actions, playerId, forTick}) => {
	tickQueue?.setForTick(forTick, playerId, actions)
})
