import { spawnBuilding } from '../3d-stuff/renderable/input-reactor'
import * as activityBuildingRoot from '../game-state/activities/buildingRoot'
import * as activityIdle from '../game-state/activities/idle'
import * as activityItemPickupRoot from '../game-state/activities/item-pickup-root'
import { BuildingId } from '../game-state/buildings'
import { DataOffsetPositions, EntityTrait } from '../game-state/entities/traits'
import { GameState } from '../game-state/game-state'
import { BlockId } from '../game-state/world/block'
import { ItemType } from '../game-state/world/item'

export function fillEmptyWorldWithDefaultData(gameState: GameState) {

	const {world, entities, surfaceResources, groundItems} = gameState

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


	groundItems.setItem(12, 14, ItemType.Box)

	const spawnUnit = (x: number, y: number, z: number) => {
		const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.ItemHoldable | EntityTrait.WithActivity | EntityTrait.Interruptible
		const entity = entities.createEntity(unitTraits)
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = x
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = y
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = z

		activityIdle.setup(gameState, entity)

		setTimeout(() => {
			const buildingId = spawnBuilding(gameState, 10, 10, BuildingId.Monument)
			if (buildingId === undefined) return
			activityBuildingRoot.setup(gameState, entity, buildingId)
			activityItemPickupRoot.setup(gameState, entity, 12, 14, ItemType.Box)
		}, 2000)

	}
	spawnUnit(7, 2, 8)
}

