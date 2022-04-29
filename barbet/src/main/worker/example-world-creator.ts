import { UnitColorPaletteId } from '../3d-stuff/renderable/unit/unit-color'
import { GameState } from '../game-state/game-state'
import { ItemType } from '../game-state/items'
import fillTerrain from '../game-state/sync-operations/fill-terrain'
import spawnUnit from '../game-state/sync-operations/spawn-unit'
import { allBiomes } from '../game-state/world/biome'
import { BlockId } from '../game-state/world/block'
import { generateBiomeMap, generateHeightMap } from '../game-state/world/generator'
import { World } from '../game-state/world/world'
import { Direction } from '../util/direction'
import CONFIG from './observable-settings'

const placeDebugFeatures = (game: GameState) => {
	const {world, groundItems} = game

	fillTerrain({
		game, fillWith: BlockId.Grass,
		x: 3, sx: world.size.sizeX - 6,
		y: 1, sy: 1,
		z: 3, sz: world.size.sizeZ - 6,
	})

	fillTerrain({
		game, fillWith: BlockId.Sand, replace: BlockId.Air,
		x: 2, sx: world.size.sizeX - 4,
		y: 1, sy: 1,
		z: 2, sz: world.size.sizeZ - 4,
	})

	fillTerrain({
		game, fillWith: BlockId.Water,
		x: 0, sx: world.size.sizeX,
		y: 0, sy: 1,
		z: 0, sz: world.size.sizeZ,
	})

	spawnUnit({game, x: 7, z: 8, color: UnitColorPaletteId.GreenOrange, facing: Direction.PositiveXNegativeZ})

	groundItems.setItem(17, 14, ItemType.Box)
	groundItems.setItem(16, 14, ItemType.Box)
	groundItems.setItem(15, 14, ItemType.Box)
	groundItems.setItem(14, 14, ItemType.Box)
	groundItems.setItem(13, 14, ItemType.Box)
	groundItems.setItem(3, 3, ItemType.Box)
}

const placeMoreRealTerrain = (game: GameState) => {
	const groundItems = game.groundItems
	generateRandomTerrain(game.world)
	spawnUnit({game, x: 57, z: 88, color: UnitColorPaletteId.GreenOrange, facing: Direction.PositiveXNegativeZ})
	groundItems.setItem(67, 77, ItemType.Box)
}

export function fillEmptyWorldWithDefaultData(game: GameState) {
	if (CONFIG.get('other/generate-debug-world'))
		placeDebugFeatures(game)
	else
		placeMoreRealTerrain(game)
}

const generateRandomTerrain = (world: World) => {

	const settings = {...world.size, biomeSeed: 12345, heightSeed: 1234}
	const biomeMap = generateBiomeMap(settings)
	const heightMap = generateHeightMap(settings)


	let index = 0
	for (let z = 0; z < settings.sizeZ; z++) {
		for (let x = 0; x < settings.sizeX; x++) {
			const biomeValue = allBiomes[biomeMap[index]!]!
			let yHere = heightMap[index]!
			world.setBlock(x, yHere, z, biomeValue.surfaceMaterialId)
			const underSurfaceMaterialId = biomeValue.underSurfaceMaterialId
			for (let y = 0; y < yHere; ++y)
				world.setBlock(x, y, z, underSurfaceMaterialId)

			if (yHere < 4) {
				const waterSurfaceMaterialId = biomeValue.waterSurfaceMaterialId
				const upperWaterLimit = 3 + (waterSurfaceMaterialId === BlockId.Water ? 0 : 1)
				for (let y = 0; y <= upperWaterLimit; ++y)
					world.setBlock(x, y, z, waterSurfaceMaterialId)
			}
			index++
		}
	}
}
