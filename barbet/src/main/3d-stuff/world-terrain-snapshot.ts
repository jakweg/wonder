import { GameState, MetadataField } from '@game'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from '@game/world/size'

export interface TerrainHeightReader {
  getHighestBlockHeight_orElse(x: number, z: number, fallback: number): number
}

export interface WorldTerrainSnapshot extends TerrainHeightReader {
  readonly sizeLevel: WorldSizeLevel
  readonly blocksPerAxis: number
  readonly heightData: Uint8Array
  readonly blockData: Uint8Array
  readonly lastWorldChangeId: number
  syncFromGameWithMutexHeld(game: GameState): boolean
}

export const createWorldTerrainSnapshot = (sizeLevel: WorldSizeLevel): WorldTerrainSnapshot => {
  const blocksPerAxis = sizeLevel * GENERIC_CHUNK_SIZE
  const totalBlocks = blocksPerAxis * blocksPerAxis
  const heightData = new Uint8Array(totalBlocks)
  const blockData = new Uint8Array(totalBlocks)
  let lastWorldChangeId = -1

  return {
    sizeLevel,
    blocksPerAxis,
    heightData,
    blockData,
    get lastWorldChangeId(): number {
      return lastWorldChangeId
    },
    syncFromGameWithMutexHeld(game: GameState): boolean {
      const worldChangeId = game.metaData[MetadataField.LastWorldChange]!
      if (worldChangeId === lastWorldChangeId) {
        return false
      }
      lastWorldChangeId = worldChangeId
      heightData.set(game.world.rawHeightData)
      blockData.set(game.world.rawBlockData)
      return true
    },
    getHighestBlockHeight_orElse(x: number, z: number, fallback: number): number {
      if (x < 0 || x >= blocksPerAxis || (x | 0) !== x || z < 0 || z >= blocksPerAxis || (z | 0) !== z) {
        return fallback
      }
      const chunkX = (x / GENERIC_CHUNK_SIZE) | 0
      const chunkZ = (z / GENERIC_CHUNK_SIZE) | 0
      const withinChunkX = (x % GENERIC_CHUNK_SIZE) | 0
      const withinChunkZ = (z % GENERIC_CHUNK_SIZE) | 0

      const chunkIndex = (((chunkX * sizeLevel) | 0) + chunkZ) | 0
      const withinChunkIndex = (((withinChunkZ * GENERIC_CHUNK_SIZE) | 0) + withinChunkX) | 0
      const absoluteIndex = chunkIndex * GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE + withinChunkIndex
      return heightData[absoluteIndex]!
    },
  }
}
