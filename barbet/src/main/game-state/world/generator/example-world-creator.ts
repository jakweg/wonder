import { GameStateImplementation } from '@game'
import * as SlimeIdle from '@game/new-entities/activities/slime/idle'
import * as SteveIdle from '@game/new-entities/activities/steve/idle'
import { INVALID_ENTITY_ID } from '@game/new-entities/id'
import { EntityKind } from '@game/new-entities/kind'
import { SLIME_COLOR_PALETTE, SLIME_SIZE_COUNT, SlimeColorId } from '@game/new-entities/stores/slime-metadata'
import {
  DEFAULT_STEVE_APPEARANCE,
  DEFAULT_STEVE_HEIGHT_STEP,
  DEFAULT_STEVE_WIDTH_STEP,
  generateRandomSteveAppearance,
  packSteveAppearance,
  SteveEyeColorId,
  SteveHairColorId,
  SteveHairStyle,
  StevePantsColorId,
  SteveShirtColorId,
  SteveShirtTrimStyle,
  SteveShoeColorId,
  SteveSkinToneId,
} from '@game/new-entities/stores/steve-metadata'
import { GENERIC_CHUNK_SIZE } from '@game/world/size'
import fillTerrain from '@sync-operations/fill-terrain'
import { Direction } from '@utils/direction'
import CONFIG from '@utils/persistence/observable-settings'
import { ItemType } from '../../items'
import { allBiomes } from '../biome'
import { BlockId } from '../block'
import { World } from '../world'
import { generateBiomeMap, generateHeightMap } from './generator'

const spawnSteveEntity = (
  game: GameStateImplementation,
  options: {
    x: number
    z: number
    facing?: Direction
    appearance?: number
  },
): void => {
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  if (options.x < 0 || options.x >= blocksPerAxis || options.z < 0 || options.z >= blocksPerAxis) return

  const block = game.world.getBlock_unsafe(options.x, options.z)
  if (block === BlockId.Air || block === BlockId.Water) return
  if (game.world.getHighestBlockHeight_unsafe(options.x, options.z) <= 0) return

  const entityId = game.entities2.spawnNewEntitySync(EntityKind.Steve)
  if (entityId === INVALID_ENTITY_ID) {
    console.warn('Unable to spawn entity')
    return
  }

  game.entities2.setPosition(entityId, options.x, options.z)
  game.entities2.setSteveAppearanceRaw(entityId, options.appearance ?? generateRandomSteveAppearance(game.seededRandom))
  game.entities2.snapFacing(entityId, options.facing ?? Direction.PositiveXNegativeZ)
  SteveIdle.push(game, entityId)
}

const spawnSlimeEntity = (
  game: GameStateImplementation,
  options: {
    x: number
    z: number
    size?: number
    color?: SlimeColorId
    facing?: Direction
  },
): void => {
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  if (options.x < 0 || options.x >= blocksPerAxis || options.z < 0 || options.z >= blocksPerAxis) return
  if (game.world.getHighestBlockHeight_unsafe(options.x, options.z) <= 0) return

  const entityId = game.entities2.spawnNewEntitySync(EntityKind.Slime)
  if (entityId === INVALID_ENTITY_ID) {
    console.warn('Unable to spawn entity')
    return
  }

  game.entities2.setPosition(entityId, options.x, options.z)
  if (options.size !== undefined) {
    game.entities2.setSlimeSize(entityId, options.size)
  }
  if (options.color !== undefined) {
    game.entities2.setSlimeColor(entityId, options.color)
  }
  game.entities2.snapFacing(entityId, options.facing ?? Direction.PositiveXNegativeZ)
  SlimeIdle.push(game, entityId)
}

const placeDebugFeatures = (game: GameStateImplementation) => {
  const { world, groundItems } = game

  const blocksPerAxis = world.sizeLevel * GENERIC_CHUNK_SIZE

  fillTerrain({
    game,
    fillWith: BlockId.Water,
    x: 0,
    sx: blocksPerAxis,
    z: 0,
    sz: blocksPerAxis,
  })

  fillTerrain({
    game,
    fillWith: BlockId.Sand,
    x: 2,
    sx: blocksPerAxis - 4,
    z: 2,
    sz: blocksPerAxis - 4,
  })

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
    x: 10,
    sx: 20,
    z: 10,
    sz: 11,
  })

  game.world.setHeight_unsafe(10, 10, 2)
  game.world.setHeight_unsafe(11, 10, 3)
  game.world.setHeight_unsafe(12, 10, 10)
  game.world.setHeight_unsafe(13, 10, 2)
  game.world.setHeight_unsafe(14, 10, 2)
  game.world.setHeight_unsafe(15, 10, 2)
  game.world.setHeight_unsafe(15, 11, 2)
  game.world.setHeight_unsafe(15, 12, 2)
  game.world.setHeight_unsafe(15, 13, 2)
  game.world.setHeight_unsafe(15, 14, 3)
  game.world.setHeight_unsafe(15, 15, 3)

  game.world.setHeight_unsafe(19, 18, 1)
  game.world.setHeight_unsafe(19, 19, 1)
  game.world.setHeight_unsafe(19, 20, 1)

  for (const index of game.world.rawHeightData.keys()) game.world.rawHeightData[index]! += 3

  groundItems.setItem(17, 14, ItemType.Box)
  groundItems.setItem(16, 14, ItemType.Box)
  groundItems.setItem(15, 14, ItemType.Box)
  groundItems.setItem(14, 14, ItemType.Box)
  groundItems.setItem(13, 14, ItemType.Box)
  groundItems.setItem(3, 3, ItemType.Box)

  // Test slimes within SuperTiny world bounds (0..31) covering the 16-step size spectrum (0..15 -> 0.4x..1.9x)
  spawnSlimeEntity(game, { x: 12, z: 10, size: 15, color: SlimeColorId.Purple, facing: Direction.PositiveXNegativeZ })
  spawnSlimeEntity(game, { x: 14, z: 8, size: 12, color: SlimeColorId.Emerald, facing: Direction.NegativeXNegativeZ })
  spawnSlimeEntity(game, { x: 7, z: 9, size: 10, color: SlimeColorId.Rainbow, facing: Direction.PositiveXPositiveZ })

  spawnSteveEntity(game, {
    x: 7,
    z: 8,
    facing: Direction.PositiveXNegativeZ,
    appearance: DEFAULT_STEVE_APPEARANCE,
  })
  spawnSteveEntity(game, { x: 19, z: 9, facing: Direction.PositiveXPositiveZ })
  spawnSteveEntity(game, { x: 5, z: 8, facing: Direction.PositiveX })
  spawnSteveEntity(game, {
    x: 20,
    z: 20,
    facing: Direction.PositiveX,
    appearance: packSteveAppearance({
      shirtColor: SteveShirtColorId.Teal,
      pantsColor: StevePantsColorId.Indigo,
      hairColor: SteveHairColorId.DarkBrown,
      skinTone: SteveSkinToneId.Tan,
      eyeColor: SteveEyeColorId.Indigo,
      shoeColor: SteveShoeColorId.Grey,
      hairStyle: SteveHairStyle.Classic,
      shirtTrimStyle: SteveShirtTrimStyle.MatchingDark,
      hasBeard: false,
      hasLongSleeves: false,
      heightStep: DEFAULT_STEVE_HEIGHT_STEP,
      widthStep: DEFAULT_STEVE_WIDTH_STEP,
    }),
  })
}

const placeMoreRealTerrain = (game: GameStateImplementation) => {
  const groundItems = game.groundItems
  const blocksPerAxis = game.world.sizeLevel * GENERIC_CHUNK_SIZE
  generateRandomTerrain(game.world)
  for (let i = 0; i < 2_000; i++) {
    spawnSlimeEntity(game, {
      x: game.seededRandom.nextInt(blocksPerAxis),
      z: game.seededRandom.nextInt(blocksPerAxis),
      facing: game.seededRandom.nextInt(8) as Direction,
      size: game.seededRandom.nextInt(SLIME_SIZE_COUNT),
      color: game.seededRandom.nextInt(SLIME_COLOR_PALETTE.length) as SlimeColorId,
    })
  }
  for (let i = 0; i < 20_000; i++) {
    spawnSteveEntity(game, {
      x: game.seededRandom.nextInt(blocksPerAxis),
      z: game.seededRandom.nextInt(blocksPerAxis),
      facing: game.seededRandom.nextInt(8) as Direction,
    })
  }
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
      world.setBlock_unsafe(x, z, biomeValue.surfaceMaterialId)
      world.setHeight_unsafe(x, z, yHere)

      if (yHere < 4) {
        const waterSurfaceMaterialId = biomeValue.waterSurfaceMaterialId
        world.setBlock_unsafe(x, z, waterSurfaceMaterialId)
        if (waterSurfaceMaterialId !== BlockId.Water) world.setHeight_unsafe(x, z, 4)
        else world.setHeight_unsafe(x, z, 3)
      }
      index++
    }
  }
}
