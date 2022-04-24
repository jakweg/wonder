import * as activityIdle from '../game-state/activities/idle'
import { DataOffsetPositions, EntityTrait } from '../game-state/entities/traits'
import { GameState } from '../game-state/game-state'
import { ItemType } from '../game-state/items'
import { BlockId } from '../game-state/world/block'

export function fillEmptyWorldWithDefaultData(gameState: GameState) {

	const {world, entities, groundItems} = gameState

	for (let i = 0, w = world.size.sizeX; i < w; i++)
		for (let j = 0, h = world.size.sizeZ; j < h; j++)
			world.setBlock(i, 0, j, BlockId.Water)

	for (let i = 2, w = world.size.sizeX - 2; i < w; i++)
		for (let j = 2, h = world.size.sizeZ - 2; j < h; j++)
			world.setBlock(i, 1, j, BlockId.Sand)
	for (let i = 3, w = world.size.sizeX - 3; i < w; i++)
		for (let j = 3, h = world.size.sizeZ - 3; j < h; j++)
			world.setBlock(i, 1, j, BlockId.Grass)

	world.recalculateHeightIndex()


	groundItems.setItem(17, 14, ItemType.Box)
	groundItems.setItem(16, 14, ItemType.Box)
	groundItems.setItem(15, 14, ItemType.Box)
	groundItems.setItem(14, 14, ItemType.Box)
	groundItems.setItem(13, 14, ItemType.Box)
	groundItems.setItem(3, 3, ItemType.Box)

	const spawnUnit = (x: number, y: number, z: number) => {
		const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.ItemHoldable | EntityTrait.WithActivity | EntityTrait.Interruptible
		const entity = entities.createEntity(unitTraits)
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = x
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = y
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = z

		activityIdle.setup(gameState, entity)
	}
	spawnUnit(7, 2, 8)
}

