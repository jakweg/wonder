import { GameState } from './3d-stuff/game-state/game-state'
import { createNewStateUpdater } from './3d-stuff/game-state/state-updater'
import { SaveMethod } from './environments/loader'
import { putSaveData } from './util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from './util/persistance/serializers'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'
import { globalMutex, setGlobalGameState, setGlobalMutex, setGlobalStateUpdater } from './worker/worker-global-state'
import { createEmptyGame, loadGameFromDb } from './worker/world-loader'

SettingsContainer.INSTANCE = SettingsContainer.createEmpty()
takeControlOverWorkerConnection()

setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data['mutex'])
})

setMessageHandler('new-settings', settings => {
	SettingsContainer.INSTANCE.update(settings)
})

let state: GameState
setMessageHandler('create-game', async (args, connection) => {
	let updater
	const stateBroadcastCallback = () => {
		connection.send('update-entity-container', {
			'buffers': state?.entities?.passBuffers(),
		})
	}

	const saveName = args['saveName']
	state = saveName !== undefined
		? await loadGameFromDb(saveName, stateBroadcastCallback)
		: createEmptyGame(stateBroadcastCallback)
	setGlobalGameState(state)

	updater = createNewStateUpdater(globalMutex, state)
	setGlobalStateUpdater(updater)

	connection.send('game-snapshot-for-renderer', {
		'game': state.passForRenderer(),
		'updater': updater.pass(),
	})
})

setMessageHandler('save-game', async (data, connection) => {
	const saveName = data['saveName']
	switch (data['method']) {
		case SaveMethod.ToIndexedDatabase: {
			setArrayEncodingType(ArrayEncodingType.AsArray)
			const rawData = state.serialize()
			setArrayEncodingType(ArrayEncodingType.None)
			await putSaveData(saveName, rawData)
		}
			break
		case SaveMethod.ToDataUrl: {
			setArrayEncodingType(ArrayEncodingType.ToString)
			const asString = JSON.stringify(state.serialize())
			setArrayEncodingType(ArrayEncodingType.None)

			const length = asString.length
			const bytes = new Uint8Array(length)
			for (let i = 0; i < length; i++)
				bytes[i] = asString.charCodeAt(i)!
			const url = URL.createObjectURL(new Blob([bytes]))

			connection.send('save-game-result', {'url': url})
		}
	}
})
