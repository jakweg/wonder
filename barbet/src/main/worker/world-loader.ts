import { CreateGameArguments } from '../environments/loader'
import { createNewDelayedComputer } from '../game-state/delayed-computer'
import EntityContainer from '../game-state/entities/entity-container'
import { GameState, GameStateImplementation } from '../game-state/game-state'
import { GroundItemsIndex } from '../game-state/ground-items-index'
import { ReceiveActionsQueue } from '../game-state/scheduled-actions/queue'
import { SurfaceResourcesIndex } from '../game-state/surface-resources/surface-resources-index'
import { TileMetaDataIndex } from '../game-state/tile-meta-data-index'
import { BlockId } from '../game-state/world/block'
import { World } from '../game-state/world/world'
import { readSaveData } from '../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../util/persistance/serializers'
import { fillEmptyWorldWithDefaultData } from './example-world-creator'
import { globalMutex } from './global-mutex'
import ObservableSettings from './observable-settings'

export const createEmptyGame = (actionsQueue: ReceiveActionsQueue,
                                stateBroadcastCallback: () => void): GameState => {
	const mutex = globalMutex
	let sizeX = 1000
	let sizeY = 50
	let sizeZ = 1000
	if (ObservableSettings.INSTANCE.get('other/generate-debug-world')) {
		sizeX = 20
		sizeY = 10
		sizeZ = 20
	}
	const world = World.createEmpty(sizeX, sizeY, sizeZ, BlockId.Air)
	const itemsOnGround = GroundItemsIndex.createNew(world.size)
	const tileMetaDataIndex = TileMetaDataIndex.createNew(world.size.sizeX, world.size.sizeZ, world.rawHeightData)
	const delayedComputer = createNewDelayedComputer()
	const entityContainer = EntityContainer.createEmptyContainer()
	const resources = SurfaceResourcesIndex.createNew(world.size)
	const gameState = GameStateImplementation.createNew(world, itemsOnGround,
		entityContainer, tileMetaDataIndex, delayedComputer,
		resources, actionsQueue, mutex, stateBroadcastCallback)

	fillEmptyWorldWithDefaultData(gameState)

	return gameState
}

export const loadGameFromDb = async (id: string, actionsQueue: ReceiveActionsQueue,
                                     stateBroadcastCallback: () => void): Promise<GameState> => {
	const data = await readSaveData(id)
	setArrayEncodingType(ArrayEncodingType.Array)
	try {
		return GameStateImplementation.deserialize(data, actionsQueue, globalMutex, stateBroadcastCallback)
	} finally {
		setArrayEncodingType(ArrayEncodingType.None)
	}
}


export const loadGameFromString = async (value: string, actionsQueue: ReceiveActionsQueue,
                                     stateBroadcastCallback: () => void): Promise<GameState> => {
	setArrayEncodingType(ArrayEncodingType.String)
	try {
		const object = JSON.parse(value)
		return GameStateImplementation.deserialize(object, actionsQueue, globalMutex, stateBroadcastCallback)
	} finally {
		setArrayEncodingType(ArrayEncodingType.None)
	}
}

export const loadGameFromFile = async (file: File,
                                       actionsQueue: ReceiveActionsQueue,
                                       stateBroadcastCallback: () => void): Promise<GameState> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader['onerror'] = reject
		reader['onload'] = () => {
			try {
				setArrayEncodingType(ArrayEncodingType.String)
				const state = GameStateImplementation.deserialize(JSON.parse(reader['result'] as string), actionsQueue, globalMutex, stateBroadcastCallback)
				setArrayEncodingType(ArrayEncodingType.None)
				resolve(state)
			} catch (e) {
				reject(e)
			}
		}
		reader['readAsText'](file)
	})
}


export const loadGameFromArgs = async (args: CreateGameArguments, actionsQueue: ReceiveActionsQueue, stateBroadcastCallback: () => any) => {
	const saveName = args.saveName
	const file = args.fileToRead
	const string = args.stringToRead

	if (string !== undefined)
		return await loadGameFromString(string, actionsQueue, stateBroadcastCallback)
	else if (file !== undefined)
		return await loadGameFromFile(file, actionsQueue, stateBroadcastCallback)
	else if (saveName !== undefined)
		return await loadGameFromDb(saveName, actionsQueue, stateBroadcastCallback)
	else
		return createEmptyGame(actionsQueue, stateBroadcastCallback)
}
