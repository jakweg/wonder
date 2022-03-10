import { GameState } from './3d-stuff/game-state/game-state'
import { createNewStateUpdater } from './3d-stuff/game-state/state-updater'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { createEmptyGame } from './worker/example-state-creator'
import { setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'
import { globalMutex, setGlobalGameState, setGlobalMutex, setGlobalStateUpdater } from './worker/worker-global-state'

SettingsContainer.INSTANCE = SettingsContainer.createEmpty()
takeControlOverWorkerConnection()

setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data.mutex)
})

setMessageHandler('new-settings', settings => {
	SettingsContainer.INSTANCE.update(settings)
})

setMessageHandler('create-game', (_, connection) => {
	let state: GameState
	let updater
	const stateBroadcastCallback = () => {
		connection.send('update-entity-container', {
			buffers: state?.entities?.passBuffers(),
		})
	}

	state = createEmptyGame(stateBroadcastCallback)
	setGlobalGameState(state)

	updater = createNewStateUpdater(globalMutex, state)
	setGlobalStateUpdater(updater)

	connection.send('game-snapshot-for-renderer', {
		game: state.passForRenderer(),
		updater: updater.pass(),
	})
})
