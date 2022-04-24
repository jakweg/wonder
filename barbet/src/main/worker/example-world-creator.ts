import * as activityIdle from '../game-state/activities/idle'
import { DataOffsetPositions, EntityTrait } from '../game-state/entities/traits'
import { GameState } from '../game-state/game-state'
import fillTerrain from '../game-state/sync-operations/fill-terrain'
import { BlockId } from '../game-state/world/block'

export function fillEmptyWorldWithDefaultData(gameState: GameState) {

	const {world} = gameState

	fillTerrain({
		game: gameState, fillWith: BlockId.Grass,
		x: 3, sx: world.size.sizeX - 6,
		y: 0, sy: 2,
		z: 3, sz: world.size.sizeZ - 6,
	})

	fillTerrain({
		game: gameState, fillWith: BlockId.Sand, replace: BlockId.Air,
		x: 2, sx: world.size.sizeX - 4,
		y: 0, sy: 2,
		z: 2, sz: world.size.sizeZ - 4,
	})

	fillTerrain({
		game: gameState, fillWith: BlockId.Water, replace: BlockId.Air,
		x: 0, sx: world.size.sizeX,
		y: 0, sy: 1,
		z: 0, sz: world.size.sizeZ,
	})

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

