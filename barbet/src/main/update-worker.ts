import { SaveMethod } from './environments/loader'
import { GameStateImplementation } from './game-state/game-state'
import { ReceiveActionsQueue } from './game-state/scheduled-actions/queue'
import { createNewStateUpdater } from './game-state/state-updater'
import { StateUpdaterImplementation } from './game-state/state-updater/implementation'
import { putSaveData } from './util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from './util/persistance/serializers'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setGlobalMutex } from './worker/global-mutex'
import { setMessageHandler } from './worker/message-handler'
import CONFIG from './worker/observable-settings'
import { loadGameFromArgs } from './worker/world-loader'

takeControlOverWorkerConnection()


let gameState: GameStateImplementation | null = null
let stateUpdater: StateUpdaterImplementation | null = null
let actionsQueue: ReceiveActionsQueue | null = null

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

	stateUpdater = createNewStateUpdater(() => gameState!.advanceActivities(), gameState.currentTick)

	connection.send('game-snapshot-for-renderer', {
		game: gameState!.passForRenderer(),
		updater: stateUpdater!.pass(),
	})
})

setMessageHandler('save-game', async (data, connection) => {
	const saveName = data.saveName
	const state = gameState
	if (state === null) return
	switch (data.method) {
		case SaveMethod.ToIndexedDatabase: {
			setArrayEncodingType(ArrayEncodingType.Array)
			const rawData = state.serialize()
			setArrayEncodingType(ArrayEncodingType.None)
			await putSaveData(saveName, rawData)
		}
			break
		case SaveMethod.ToString: {
			setArrayEncodingType(ArrayEncodingType.String)
			const rawData = JSON.stringify(state.serialize())
			setArrayEncodingType(ArrayEncodingType.None)
			connection.send('feedback', {type: 'saved-to-string', value: rawData})
		}
			break
		case SaveMethod.ToDataUrl: {
			setArrayEncodingType(ArrayEncodingType.String)
			const asString = JSON.stringify(state.serialize())
			setArrayEncodingType(ArrayEncodingType.None)

			const length = asString.length
			const bytes = new Uint8Array(length)
			for (let i = 0; i < length; i++)
				bytes[i] = asString.charCodeAt(i)!
			const url = URL.createObjectURL(new Blob([bytes]))

			connection.send('feedback', {type: 'saved-to-url', url: url})
		}
	}
})

setMessageHandler('scheduled-action', (action) => {
	actionsQueue?.append(action)
})
