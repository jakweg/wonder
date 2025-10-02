import { GameStateImplementation } from '@game'
import fillTerrain from '@sync-operations/fill-terrain'
import spawnSlime from '@sync-operations/spawn-slime'
import { Direction } from '@utils/direction'
import CONFIG from '@utils/persistence/observable-settings'
import { ItemType } from '../../items'
import { allBiomes } from '../biome'
import { BlockId } from '../block'
import { World } from '../world'
import { generateBiomeMap, generateHeightMap } from './generator'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'

const placeDebugFeatures = (game: GameStateImplementation) => {
  const { world, groundItems } = game

  const blocksPerAxis = world.sizeLevel * GENERIC_CHUNK_SIZE

  fillTerrain({
    game,
    fillWith: BlockId.Grass,
    x: 3,
    sx: blocksPerAxis - 6,
    z: 3,
    sz: blocksPerAxis - 6,
  })

  fillTerrain({
    game,
    fillWith: BlockId.Sand,
    replace: BlockId.Air,
    x: 2,
    sx: blocksPerAxis - 4,
    z: 2,
    sz: blocksPerAxis - 4,
  })

  fillTerrain({
    game,
    fillWith: BlockId.Water,
    x: 0,
    sx: blocksPerAxis,
    z: 0,
    sz: blocksPerAxis,
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
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  generateRandomTerrain(game.world)
  for (let i = 0; i < 10_000; i++)
    spawnSlime({
      game,
      x: game.seededRandom.nextInt(blocksPerAxis),
      z: game.seededRandom.nextInt(blocksPerAxis),
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
  const blocksPerAxis = world.sizeLevel * GENERIC_CHUNK_SIZE
  const settings = { blocksPerAxis, biomeSeed: 12345, heightSeed: 1234 }
  const biomeMap = generateBiomeMap(settings)
  const heightMap = generateHeightMap(settings)

  let index = 0
  for (let z = 0; z < blocksPerAxis; z++) {
    for (let x = 0; x < blocksPerAxis; x++) {
      const biomeValue = allBiomes[biomeMap[index]!]!
      let yHere = heightMap[index]!
      world.setBlock(x, z, biomeValue.surfaceMaterialId)
      world.setHeight(x, z, yHere)

      if (yHere < 4) {
        const waterSurfaceMaterialId = biomeValue.waterSurfaceMaterialId
        world.setBlock(x, z, waterSurfaceMaterialId)
        if (waterSurfaceMaterialId !== BlockId.Water) world.setHeight(x, z, yHere + 1)
      }
      index++
    }
  }
}
