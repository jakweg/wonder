import { StateUpdater } from './3d-stuff/game-state/state-updater'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { createEmptyGame } from './worker/example-state-creator'
import { setMessageHandler } from './worker/message-handler'
import { setGlobalGameState, setGlobalMutex, setGlobalStateUpdater } from './worker/worker-global-state'

takeControlOverWorkerConnection()

setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})


setMessageHandler('create-game', (_, connection) => {
	const state = createEmptyGame()
	setGlobalGameState(state)

	const updater = StateUpdater.createNew(state, 20)
	setGlobalStateUpdater(updater)

	const pass = state.passForRenderer()
	connection.send('game-snapshot-for-renderer', {
		game: pass,
	})
})
