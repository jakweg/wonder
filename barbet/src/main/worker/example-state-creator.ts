import activityIdle from '../3d-stuff/game-state/activities/idle'
import { interruptRequestWalk } from '../3d-stuff/game-state/activities/interrupt'
import EntityContainer from '../3d-stuff/game-state/entities/entity-container'
import { DataOffsetPositions, EntityTrait } from '../3d-stuff/game-state/entities/traits'
import { GameState } from '../3d-stuff/game-state/game-state'
import { GroundItemsIndex } from '../3d-stuff/game-state/ground-items-index'
import { PathFinder } from '../3d-stuff/game-state/path-finder'
import { BlockId } from '../3d-stuff/world/block'
import { World } from '../3d-stuff/world/world'
import { globalMutex } from './worker-global-state'

export const createEmptyGame = () => {
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
	itemsOnGround.setItem(5, 9, 1)
	itemsOnGround.setItem(6, 9, 1)
	const entityContainer = EntityContainer.createEmptyContainer()
	const mutex = globalMutex
	const pathFinder = PathFinder.createNewQueue(world)
	const gameState = GameState.createNew(world, itemsOnGround, entityContainer, pathFinder, mutex)

	{
		const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.ItemHoldable | EntityTrait.WithActivity | EntityTrait.Interruptible
		const entity = entityContainer.createEntity(unitTraits)
		entityContainer.positions.rawData[entity.position + DataOffsetPositions.PositionX] = 8
		entityContainer.positions.rawData[entity.position + DataOffsetPositions.PositionY] = 2
		entityContainer.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = 6
		activityIdle.setup(gameState, entity)
		interruptRequestWalk(entityContainer, entity, 10, 10)
	}

	return gameState
}