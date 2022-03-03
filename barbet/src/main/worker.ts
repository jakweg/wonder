console.log(performance.now())
import { createNewStateUpdater } from './3d-stuff/game-state/state-updater'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { createEmptyGame } from './worker/example-state-creator'
import { setMessageHandler } from './worker/message-handler'
import {
	globalMutex,
	globalStateUpdater,
	setGlobalGameState,
	setGlobalMutex,
	setGlobalStateUpdater,
} from './worker/worker-global-state'

takeControlOverWorkerConnection()

setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})


setMessageHandler('create-game', (_, connection) => {
	const state = createEmptyGame()
	setGlobalGameState(state)

	const updater = createNewStateUpdater(globalMutex, state)
	setGlobalStateUpdater(updater)

	connection.send('game-snapshot-for-renderer', {
		game: state.passForRenderer(),
		updater: updater.pass(),
	})
})

setMessageHandler('start-game', () => {
	globalStateUpdater?.start()
})
