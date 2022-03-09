import activityMiningResource from '../3d-stuff/game-state/activities/mining-resource/mining-resource'
import EntityContainer from '../3d-stuff/game-state/entities/entity-container'
import { DataOffsetPositions, EntityTrait } from '../3d-stuff/game-state/entities/traits'
import { GameState } from '../3d-stuff/game-state/game-state'
import { GroundItemsIndex } from '../3d-stuff/game-state/ground-items-index'
import { PathFinder } from '../3d-stuff/game-state/path-finder'
import { SurfaceResourcesIndex } from '../3d-stuff/game-state/surface-resources-index'
import { BlockId } from '../3d-stuff/world/block'
import { ItemType } from '../3d-stuff/world/item'
import { SurfaceResourceType } from '../3d-stuff/world/surface-resource'
import { World } from '../3d-stuff/world/world'
import { Direction } from '../util/direction'
import { globalMutex } from './worker-global-state'

export const createEmptyGame = (stateBroadcastCallback: () => void) => {
	const world = World.createEmpty(20, 30, 20, BlockId.Air)
	for (let i = 0, w = world.size.sizeX; i < w; i++)
		for (let j = 0, h = world.size.sizeZ; j < h; j++)
			world.setBlock(i, 0, j, BlockId.Water)

	for (let i = 2, w = world.size.sizeX - 2; i < w; i++)
		for (let j = 2, h = world.size.sizeZ - 2; j < h; j++)
			world.setBlock(i, 1, j, BlockId.Sand)
	for (let i = 3, w = world.size.sizeX - 3; i < w; i++)
		for (let j = 3, h = world.size.sizeZ - 3; j < h; j++)
			world.setBlock(i, 1, j, BlockId.Grass)

	world.setBlock(7, 2, 14, BlockId.Stone)
	world.setBlock(7, 3, 14, BlockId.Stone)
	world.setBlock(6, 2, 13, BlockId.Stone)
	world.setBlock(6, 3, 13, BlockId.Stone)
	world.recalculateHeightIndex()

	const itemsOnGround = GroundItemsIndex.createNew(world.size)
	itemsOnGround.setItem(5, 9, ItemType.Box)
	itemsOnGround.setItem(6, 9, ItemType.Box)
	const entityContainer = EntityContainer.createEmptyContainer()
	const mutex = globalMutex
	const pathFinder = PathFinder.createNewQueue(world)
	const resources = SurfaceResourcesIndex.createNew(world.size)
	resources.setResource(11, 5, SurfaceResourceType.Stone, 3)
	const gameState = GameState.createNew(world, itemsOnGround, entityContainer, pathFinder, resources, mutex, stateBroadcastCallback)

	const spawnUnit = (x: number, y: number, z: number) => {
		const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.ItemHoldable | EntityTrait.WithActivity | EntityTrait.Interruptible
		const entity = entityContainer.createEntity(unitTraits)
		entityContainer.positions.rawData[entity.position + DataOffsetPositions.PositionX] = x
		entityContainer.positions.rawData[entity.position + DataOffsetPositions.PositionY] = y
		entityContainer.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = z
		activityMiningResource.setup(gameState, entity, Direction.PositiveX)
		// interruptRequestWalk(entityContainer, entity, 10, 10)
	}
	setTimeout(() => {
		for (let i = 0; i < 7; i++) {
			spawnUnit(i + 4, 2, i + 5)
		}
	}, 1000)

	return gameState
}
