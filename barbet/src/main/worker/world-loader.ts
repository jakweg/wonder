import { createNewDelayedComputer } from '../game-state/delayed-computer'
import EntityContainer from '../game-state/entities/entity-container'
import { GameState, GameStateImplementation } from '../game-state/game-state'
import { GroundItemsIndex } from '../game-state/ground-items-index'
import { SurfaceResourcesIndex } from '../game-state/surface-resources/surface-resources-index'
import { TileMetaDataIndex } from '../game-state/tile-meta-data-index'
import { BlockId } from '../game-state/world/block'
import { World } from '../game-state/world/world'
import { readSaveData } from '../util/persistance/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '../util/persistance/serializers'
import { fillEmptyWorldWithDefaultData } from './example-world-creator'
import { globalMutex } from './worker-global-state'

export const createEmptyGame = (stateBroadcastCallback: () => void): GameState => {
	const mutex = globalMutex
	const world = World.createEmpty(20, 30, 20, BlockId.Air)
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
