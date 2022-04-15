import EntityContainer from '../3d-stuff/game-state/entities/entity-container'
import { GameState } from '../3d-stuff/game-state/game-state'
import { GroundItemsIndex } from '../3d-stuff/game-state/ground-items-index'
import { PathFinder } from '../3d-stuff/game-state/path-finder'
import { SurfaceResourcesIndex } from '../3d-stuff/game-state/surface-resources-index'
import { TileMetaDataIndex } from '../3d-stuff/game-state/tile-meta-data-index'
import { BlockId } from '../3d-stuff/world/block'
import { World } from '../3d-stuff/world/world'
import { readSaveData } from '../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../util/persistance/serializers'
import { fillEmptyWorldWithDefaultData } from './example-world-creator'
import { globalMutex } from './worker-global-state'

export const createEmptyGame = (stateBroadcastCallback: () => void): GameState => {
	const mutex = globalMutex
	const world = World.createEmpty(20, 30, 20, BlockId.Air)
	const itemsOnGround = GroundItemsIndex.createNew(world.size)
	const tileMetaDataIndex = TileMetaDataIndex.createNew(world.size.sizeX, world.size.sizeZ, world.rawHeightData)
	const pathFinder = PathFinder.createNewQueue(tileMetaDataIndex)
	const entityContainer = EntityContainer.createEmptyContainer()
	const resources = SurfaceResourcesIndex.createNew(world.size)
	const gameState = GameState.createNew(world, itemsOnGround,
		entityContainer, tileMetaDataIndex, pathFinder,
		resources, mutex, stateBroadcastCallback)

	fillEmptyWorldWithDefaultData(gameState)

	return gameState
}

export const loadGameFromDb = async (id: string, stateBroadcastCallback: () => void): Promise<GameState> => {
	const data = await readSaveData(id)
	setArrayEncodingType(ArrayEncodingType.Array)
	try {
		return GameState.deserialize(data, globalMutex, stateBroadcastCallback)
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
				const state = GameState.deserialize(JSON.parse(reader['result'] as string), globalMutex, stateBroadcastCallback)
				setArrayEncodingType(ArrayEncodingType.None)
				resolve(state)
			} catch (e) {
				reject(e)
			}
		}
		reader['readAsText'](file)
	})
}
