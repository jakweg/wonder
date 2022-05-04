import { CreateGameArguments } from '../../entry-points/feature-environments/loader'
import CONFIG from '../../util/persistance/observable-settings'
import { readSaveData } from '../../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../../util/persistance/serializers'
import { globalMutex } from '../../util/worker/global-mutex'
import { createNewDelayedComputer } from '../delayed-computer'
import EntityContainer from '../entities/entity-container'
import { GameState, GameStateImplementation } from '../game-state'
import { GroundItemsIndex } from '../ground-items-index'
import { SurfaceResourcesIndex } from '../surface-resources/surface-resources-index'
import { TileMetaDataIndex } from '../tile-meta-data-index'
import { BlockId } from './block'
import { fillEmptyWorldWithDefaultData } from './generator/example-world-creator'
import { World } from './world'

export const createEmptyGame = (stateBroadcastCallback: () => void): GameState => {
	const mutex = globalMutex
	let sizeX = 1000
	let sizeY = 50
	let sizeZ = 1000
	if (CONFIG.get('other/generate-debug-world')) {
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
		resources, mutex, stateBroadcastCallback)

	fillEmptyWorldWithDefaultData(gameState)

	return gameState
}

export const loadGameFromDb = async (id: string, stateBroadcastCallback: () => void): Promise<GameState> => {
	const data = await readSaveData(id)
	setArrayEncodingType(ArrayEncodingType.Array)
	try {
		return GameStateImplementation.deserialize(data, globalMutex, stateBroadcastCallback)
	} finally {
		setArrayEncodingType(ArrayEncodingType.None)
	}
}


export const loadGameFromString = async (value: string, stateBroadcastCallback: () => void): Promise<GameState> => {
	setArrayEncodingType(ArrayEncodingType.String)
	try {
		const object = JSON.parse(value)
		return GameStateImplementation.deserialize(object, globalMutex, stateBroadcastCallback)
	} finally {
		setArrayEncodingType(ArrayEncodingType.None)
	}
}

export const loadGameFromFile = async (file: File, stateBroadcastCallback: () => void): Promise<GameState> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader['onerror'] = reject
		reader['onload'] = () => {
			try {
				setArrayEncodingType(ArrayEncodingType.String)
				const state = GameStateImplementation.deserialize(JSON.parse(reader['result'] as string), globalMutex, stateBroadcastCallback)
				setArrayEncodingType(ArrayEncodingType.None)
				resolve(state)
			} catch (e) {
				reject(e)
			}
		}
		reader['readAsText'](file)
	})
}


export const loadGameFromArgs = async (args: CreateGameArguments, stateBroadcastCallback: () => any) => {
	const saveName = args.saveName
	const file = args.fileToRead
	const string = args.stringToRead

	if (string !== undefined)
		return await loadGameFromString(string, stateBroadcastCallback)
	else if (file !== undefined)
		return await loadGameFromFile(file, stateBroadcastCallback)
	else if (saveName !== undefined)
		return await loadGameFromDb(saveName, stateBroadcastCallback)
	else
		return createEmptyGame(stateBroadcastCallback)
}
