import { CreateGameArguments } from '../../entry-points/feature-environments/loader'
import { GameMutex } from '../../util/game-mutex'
import CONFIG from '../../util/persistance/observable-settings'
import { readSaveData } from '../../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../../util/persistance/serializers'
import { UpdateDebugDataCollector } from '../../util/worker/debug-stats/update'
import { createNewDelayedComputer } from '../delayed-computer'
import EntityContainer from '../entities/entity-container'
import { GameState, GameStateImplementation } from '../game-state'
import { GroundItemsIndex } from '../ground-items-index'
import { SurfaceResourcesIndex } from '../surface-resources/surface-resources-index'
import { TileMetaDataIndex } from '../tile-meta-data-index'
import { BlockId } from './block'
import { fillEmptyWorldWithDefaultData } from './generator/example-world-creator'
import { World } from './world'

export const createEmptyGame = (mutex: GameMutex, stateBroadcastCallback: () => void): GameState => {
	let sizeX = 1000
	let sizeY = 50
	let sizeZ = 1000
	if (CONFIG.get('debug/debug-world')) {
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

export const loadGameFromDb = async (id: string, mutex: GameMutex, stateBroadcastCallback: () => void): Promise<GameState> => {
	const data = await readSaveData(id)
	setArrayEncodingType(ArrayEncodingType.Array)
	try {
		return GameStateImplementation.deserialize(data, mutex, stateBroadcastCallback)
	} finally {
		setArrayEncodingType(ArrayEncodingType.None)
	}
}


export const loadGameFromString = async (value: string, mutex: GameMutex, stateBroadcastCallback: () => void): Promise<GameState> => {
	setArrayEncodingType(ArrayEncodingType.String)
	try {
		const object = JSON.parse(value)
		return GameStateImplementation.deserialize(object, mutex, stateBroadcastCallback)
	} finally {
		setArrayEncodingType(ArrayEncodingType.None)
	}
}

export const loadGameFromFile = async (file: File, mutex: GameMutex, stateBroadcastCallback: () => void): Promise<GameState> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader['onerror'] = reject
		reader['onload'] = () => {
			try {
				setArrayEncodingType(ArrayEncodingType.String)
				const state = GameStateImplementation.deserialize(JSON.parse(reader['result'] as string), mutex, stateBroadcastCallback)
				setArrayEncodingType(ArrayEncodingType.None)
				resolve(state)
			} catch (e) {
				reject(e)
			}
		}
		reader['readAsText'](file)
	})
}


export const loadGameFromArgs = async (args: CreateGameArguments,
	stats: UpdateDebugDataCollector,
	mutex: GameMutex,
	stateBroadcastCallback: () => any) => {
	const start = performance['now']()
	const saveName = args.saveName
	const file = args.fileToRead
	const string = args.stringToRead

	try {
		if (string !== undefined)
			return await loadGameFromString(string, mutex, stateBroadcastCallback)
		else if (file !== undefined)
			return await loadGameFromFile(file, mutex, stateBroadcastCallback)
		else if (saveName !== undefined)
			return await loadGameFromDb(saveName, mutex, stateBroadcastCallback)
		else
			return createEmptyGame(mutex, stateBroadcastCallback)
	} finally {
		const duration = performance['now']() - start
		stats.setLoadingGameTime(duration)
	}
}
