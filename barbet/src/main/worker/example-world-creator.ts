import { UnitColorPaletteId } from '../3d-stuff/renderable/unit/unit-color'
import { GameState } from '../game-state/game-state'
import { ItemType } from '../game-state/items'
import fillTerrain from '../game-state/sync-operations/fill-terrain'
import spawnUnit from '../game-state/sync-operations/spawn-unit'
import { BlockId } from '../game-state/world/block'

export function fillEmptyWorldWithDefaultData(game: GameState) {

	const {world, groundItems} = game

	fillTerrain({
		game, fillWith: BlockId.Grass,
		x: 3, sx: world.size.sizeX - 6,
		y: 0, sy: 2,
		z: 3, sz: world.size.sizeZ - 6,
	})

	fillTerrain({
		game, fillWith: BlockId.Sand, replace: BlockId.Air,
		x: 2, sx: world.size.sizeX - 4,
		y: 0, sy: 2,
		z: 2, sz: world.size.sizeZ - 4,
	})

	fillTerrain({
		game, fillWith: BlockId.Water, replace: BlockId.Air,
		x: 0, sx: world.size.sizeX,
		y: 0, sy: 1,
		z: 0, sz: world.size.sizeZ,
	})

	spawnUnit({game, x: 7, z: 8, color: UnitColorPaletteId.DarkBlue})


	groundItems.setItem(17, 14, ItemType.Box)
	groundItems.setItem(16, 14, ItemType.Box)
	groundItems.setItem(15, 14, ItemType.Box)
	groundItems.setItem(14, 14, ItemType.Box)
	groundItems.setItem(13, 14, ItemType.Box)
	groundItems.setItem(3, 3, ItemType.Box)
}

