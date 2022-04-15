import activityIdle from '../3d-stuff/game-state/activities/idle'
import { interruptRequestWalk } from '../3d-stuff/game-state/activities/interrupt'
import { DataOffsetPositions, EntityTrait } from '../3d-stuff/game-state/entities/traits'
import { GameState } from '../3d-stuff/game-state/game-state'
import { BlockId } from '../3d-stuff/world/block'

export function fillEmptyWorldWithDefaultData(gameState: GameState) {

	// const {world, entities} = gameState
	// world.setBlock(world.size.sizeX / 2 | 0, 2, world.size.sizeZ / 2 | 0, BlockId.Sand)
	//
	// const spawnBuilding = (x: number, y: number, z: number, type: BuildingId) => {
	// 	const traits = EntityTrait.Position | EntityTrait.BuildingData
	// 	const entity = entities.createEntity(traits)
	//
	// 	entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = x
	// 	entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = y
	// 	entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = z
	// 	entities.buildingData.rawData[entity.buildingData + DataOffsetBuildingData.TypeId] = type
	// }
	//
	// spawnBuilding(10,5,10, BuildingId.Monument)

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

	const spawnUnit = (x: number, y: number, z: number) => {
		const unitTraits = EntityTrait.Position | EntityTrait.Drawable | EntityTrait.ItemHoldable | EntityTrait.WithActivity | EntityTrait.Interruptible
		const entity = entities.createEntity(unitTraits)
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionX] = x
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionY] = y
		entities.positions.rawData[entity.position + DataOffsetPositions.PositionZ] = z
		activityIdle.setup(gameState, entity)
		interruptRequestWalk(entities, entity, 17, 16)
		// activityMiningResource.setup(gameState, entity, Direction.PositiveX)
		// interruptRequestWalk(entityContainer, entity, 10, 10)
	}
	spawnUnit(5, 2, 5)
}

