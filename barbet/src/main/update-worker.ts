import { SaveMethod } from './environments/loader'
import { GameStateImplementation } from './game-state/game-state'
import { createNewStateUpdater } from './game-state/state-updater'
import { computeWorldBoundingBox } from './game-state/world/bounding-box'
import { World } from './game-state/world/world'
import { putSaveData } from './util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from './util/persistance/serializers'
import { takeControlOverWorkerConnection } from './worker/connections-manager'
import { setMessageHandler } from './worker/message-handler'
import SettingsContainer from './worker/observable-settings'
import {
	globalGameState,
	globalMutex,
	globalStateUpdater,
	setGlobalGameState,
	setGlobalMutex,
	setGlobalStateUpdater,
} from './worker/worker-global-state'
import { createEmptyGame, loadGameFromDb, loadGameFromFile } from './worker/world-loader'

SettingsContainer.INSTANCE = SettingsContainer.createEmpty()
takeControlOverWorkerConnection()

setMessageHandler('set-global-mutex', (data) => {
	setGlobalMutex(data['mutex'])
})

setMessageHandler('new-settings', settings => {
	SettingsContainer.INSTANCE.update(settings)
})

setMessageHandler('terminate-game', () => {
	globalStateUpdater?.terminate()
	setGlobalGameState(null)
	setGlobalStateUpdater(null)
})

setMessageHandler('create-game', async (args, connection) => {
	let updater
	const stateBroadcastCallback = () => {
		if (globalGameState === null) return
		connection.send('update-entity-container', {
			'buffers': globalGameState?.entities?.passBuffers(),
		})
	}

	const saveName = args['saveName']
	const file = args['fileToRead']
	const state = file !== undefined
		? await loadGameFromFile(file, stateBroadcastCallback)
		: (saveName !== undefined
			? await loadGameFromDb(saveName, stateBroadcastCallback)
			: createEmptyGame(stateBroadcastCallback))
	setGlobalGameState(state)

	updater = createNewStateUpdater(globalMutex, state)
	setGlobalStateUpdater(updater)

	connection.send('game-snapshot-for-renderer', {
		'game': (state as GameStateImplementation).passForRenderer(),
		'updater': updater.pass(),
	})
})

setMessageHandler('save-game', async (data, connection) => {
	const saveName = data['saveName']
	const state = globalGameState as GameStateImplementation
	if (state === null) return
	switch (data['method']) {
		case SaveMethod.ToIndexedDatabase: {
			setArrayEncodingType(ArrayEncodingType.Array)
			const rawData = state.serialize()
			setArrayEncodingType(ArrayEncodingType.None)
			await putSaveData(saveName, rawData)
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

			connection.send('save-game-result', {'url': url})
		}
	}
})

setMessageHandler('debug', (data) => {
	const type = data['type']
	if (type !== 'create-building-prototype')
		return

	if (globalGameState == null) return
	const world = globalGameState!.world
	const box = computeWorldBoundingBox(world)

	const newOne = World.createEmpty(box.maxX - box.minX + 1, box.maxY - box.minY, box.maxZ - box.minZ + 1)

	World.copyFragment(world, newOne,
		box.minX, box.minY, box.minZ,
		0, 0, 0,
		newOne.size.sizeX, newOne.size.sizeY, newOne.size.sizeZ)

	setArrayEncodingType(ArrayEncodingType.String)
	console.log(newOne.serialize())
	setArrayEncodingType(ArrayEncodingType.None)
})
