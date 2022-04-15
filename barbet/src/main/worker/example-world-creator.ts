import activityBuildingRoot from '../3d-stuff/game-state/activities/buildingRoot'
import activityIdle from '../3d-stuff/game-state/activities/idle'
import { BuildingId } from '../3d-stuff/game-state/buildings/building'
import { DataOffsetPositions, EntityTrait } from '../3d-stuff/game-state/entities/traits'
import { GameState } from '../3d-stuff/game-state/game-state'
import { spawnBuilding } from '../3d-stuff/renderable/input-reactor'
import { BlockId } from '../3d-stuff/world/block'

export function fillEmptyWorldWithDefaultData(gameState: GameState) {

	const {world, entities, surfaceResources, groundItems} = gameState

	world.setBlock(world.size.sizeX / 2 | 0, 2, world.size.sizeZ / 2 | 0, BlockId.Sand)

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

	const buildingId = spawnBuilding(gameState, 10, 10, BuildingId.Monument)
	if (buildingId === undefined) return

	const spawnUnit = (x: number, y: number, z: number) => {
		const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.ItemHoldable | EntityTrait.WithActivity | EntityTrait.Interruptible
		const entity = entities.createEntity(unitTraits)
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = x
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = y
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = z

		// activityBuilding.setup(gameState, entity, Direction.NegativeX)
		activityIdle.setup(gameState, entity)
		activityBuildingRoot.setup(gameState, entity, buildingId)
	}
	spawnUnit(5, 2, 5)
}

