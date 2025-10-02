import { CreateGameArguments } from '@entry/feature-environments/loader'
import { GameState, GameStateImplementation } from '@game'
import { createNewDelayedComputer } from '@game/delayed-computer'
import EntityContainer from '@game/entities/entity-container'
import SeededRandom from '@seampan/seeded-random'
import { GameMutex } from '@utils/game-mutex'
import CONFIG from '@utils/persistence/observable-settings'
import { readSaveData } from '@utils/persistence/saves-database'
import { ArrayEncodingType, setArrayEncodingType } from '@utils/persistence/serializers'
import { UpdateDebugDataCollector } from '@utils/worker/debug-stats/update'
import { GroundItemsIndex } from '../ground-items-index'
import { SurfaceResourcesIndex } from '../surface-resources/surface-resources-index'
import { TileMetaDataIndex } from '../tile-meta-data-index'
import { BlockId } from './block'
import { fillEmptyWorldWithDefaultData } from './generator/example-world-creator'
import { World } from './world'
import { WorldSizeLevel } from './size'

export const createEmptyGame = (mutex: GameMutex, stateBroadcastCallback: () => void): GameState => {
  const sizeLevel: WorldSizeLevel = CONFIG.get('debug/debug-world') ? WorldSizeLevel.SuperTiny : WorldSizeLevel.Medium

  const world = World.createEmpty(sizeLevel)
  const itemsOnGround = GroundItemsIndex.createNew(world.sizeLevel)
  const tileMetaDataIndex = TileMetaDataIndex.createNew(world.sizeLevel, world.rawHeightData)
  const delayedComputer = createNewDelayedComputer()
  const entityContainer = EntityContainer.createEmptyContainer()
  const resources = SurfaceResourcesIndex.createNew(world.sizeLevel)
  const random = SeededRandom.fromSeed(1)
  const gameState = GameStateImplementation.createNew(
    world,
    itemsOnGround,
    entityContainer,
    tileMetaDataIndex,
    delayedComputer,
    resources,
    random,
    mutex,
    stateBroadcastCallback,
  )

  fillEmptyWorldWithDefaultData(gameState)

  return gameState
}

export const loadGameFromDb = async (
  id: string,
  mutex: GameMutex,
  stateBroadcastCallback: () => void,
): Promise<GameState> => {
  const data = await readSaveData(id)
  setArrayEncodingType(ArrayEncodingType.Array)
  try {
    return GameStateImplementation.deserialize(data, mutex, stateBroadcastCallback)
  } finally {
    setArrayEncodingType(ArrayEncodingType.None)
  }
}

export const loadGameFromString = async (
  value: string,
  mutex: GameMutex,
  stateBroadcastCallback: () => void,
): Promise<GameState> => {
  setArrayEncodingType(ArrayEncodingType.String)
  try {
    const object = JSON.parse(value)
    return GameStateImplementation.deserialize(object, mutex, stateBroadcastCallback)
  } finally {
    setArrayEncodingType(ArrayEncodingType.None)
  }
}

export const loadGameFromFile = async (
  file: File,
  mutex: GameMutex,
  stateBroadcastCallback: () => void,
): Promise<GameState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader['onerror'] = reject
    reader['onload'] = () => {
      try {
        setArrayEncodingType(ArrayEncodingType.String)
        const state = GameStateImplementation.deserialize(
          JSON.parse(reader['result'] as string),
          mutex,
          stateBroadcastCallback,
        )
        setArrayEncodingType(ArrayEncodingType.None)
        resolve(state)
      } catch (e) {
        reject(e)
      }
    }
    reader['readAsText'](file)
  })
}

export const loadGameFromArgs = async (
  args: CreateGameArguments,
  stats: UpdateDebugDataCollector,
  mutex: GameMutex,
  stateBroadcastCallback: () => any,
) => {
  const start = performance['now']()
  const saveName = args.saveName
  const file = args.fileToRead
  const string = args.stringToRead

  try {
    if (string !== undefined) return await loadGameFromString(string, mutex, stateBroadcastCallback)
    else if (file !== undefined) return await loadGameFromFile(file, mutex, stateBroadcastCallback)
    else if (saveName !== undefined) return await loadGameFromDb(saveName, mutex, stateBroadcastCallback)
    else return createEmptyGame(mutex, stateBroadcastCallback)
  } finally {
    const duration = performance['now']() - start
    stats.setLoadingGameTime(duration)
  }
}
