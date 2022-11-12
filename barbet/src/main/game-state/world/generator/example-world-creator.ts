import { GameStateImplementation } from '@game'
import fillTerrain from '@sync-operations/fill-terrain'
import spawnSlime from '@sync-operations/spawn-slime'
import { Direction } from '@utils/direction'
import CONFIG from '@utils/persistance/observable-settings'
import { ItemType } from '../../items'
import { allBiomes } from '../biome'
import { BlockId } from '../block'
import { World } from '../world'
import { generateBiomeMap, generateHeightMap } from './generator'

const placeDebugFeatures = (game: GameStateImplementation) => {
  const { world, groundItems } = game

  fillTerrain({
    game,
    fillWith: BlockId.Grass,
    x: 3,
    sx: world.size.sizeX - 6,
    y: 1,
    sy: 1,
    z: 3,
    sz: world.size.sizeZ - 6,
  })

  fillTerrain({
    game,
    fillWith: BlockId.Sand,
    replace: BlockId.Air,
    x: 2,
    sx: world.size.sizeX - 4,
    y: 1,
    sy: 1,
    z: 2,
    sz: world.size.sizeZ - 4,
  })

  fillTerrain({
    game,
    fillWith: BlockId.Water,
    x: 0,
    sx: world.size.sizeX,
    y: 0,
    sy: 1,
    z: 0,
    sz: world.size.sizeZ,
  })

  // spawnUnit({ game, x: 7, z: 8, color: 0/* UnitColorPaletteId.GreenOrange */, facing: Direction.PositiveXNegativeZ })
  spawnSlime({ game, x: 4, z: 11, facing: Direction.PositiveXNegativeZ })
  spawnSlime({ game, x: 8, z: 8, facing: Direction.PositiveXNegativeZ })
  spawnSlime({ game, x: 9, z: 4, facing: Direction.PositiveXNegativeZ })

  groundItems.setItem(17, 14, ItemType.Box)
  groundItems.setItem(16, 14, ItemType.Box)
  groundItems.setItem(15, 14, ItemType.Box)
  groundItems.setItem(14, 14, ItemType.Box)
  groundItems.setItem(13, 14, ItemType.Box)
  groundItems.setItem(3, 3, ItemType.Box)
}

const placeMoreRealTerrain = (game: GameStateImplementation) => {
  const groundItems = game.groundItems
  generateRandomTerrain(game.world)
  for (let i = 0; i < 100_000; i++)
    spawnSlime({
      game,
      x: game.seededRandom.nextInt(game.world.size.sizeX),
      z: game.seededRandom.nextInt(game.world.size.sizeZ),
      facing: game.seededRandom.nextInt(8),
      size: game.seededRandom.nextInt(3) + 1,
      color: game.seededRandom.nextInt(0xffffff),
    })
  groundItems.setItem(67, 77, ItemType.Box)
}

export function fillEmptyWorldWithDefaultData(game: GameStateImplementation) {
  if (CONFIG.get('debug/debug-world')) placeDebugFeatures(game)
  else placeMoreRealTerrain(game)
}

const generateRandomTerrain = (world: World) => {
  const settings = { ...world.size, biomeSeed: 12345, heightSeed: 1234 }
  const biomeMap = generateBiomeMap(settings)
  const heightMap = generateHeightMap(settings)

  let index = 0
  for (let z = 0; z < settings.sizeZ; z++) {
    for (let x = 0; x < settings.sizeX; x++) {
      const biomeValue = allBiomes[biomeMap[index]!]!
      let yHere = heightMap[index]!
      world.setBlock(x, yHere, z, biomeValue.surfaceMaterialId)
      const underSurfaceMaterialId = biomeValue.underSurfaceMaterialId
      for (let y = 0; y < yHere; ++y) world.setBlock(x, y, z, underSurfaceMaterialId)

      if (yHere < 4) {
        const waterSurfaceMaterialId = biomeValue.waterSurfaceMaterialId
        const upperWaterLimit = 3 + (waterSurfaceMaterialId === BlockId.Water ? 0 : 1)
        for (let y = 0; y <= upperWaterLimit; ++y) world.setBlock(x, y, z, waterSurfaceMaterialId)
      }
      index++
    }
  }
}
