import { decodeArray, encodeArray } from '@utils/persistence/serializers'
import { createNewBuffer } from '@utils/shared-memory'
import { AIR_ID, BlockId } from './block'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from './size'

/** @deprecated use GENERIC_CHUNK_SIZE instead */
export const WORLD_CHUNK_SIZE = 64

/** @deprecated  */
export interface WorldSize {
  readonly sizeX: number
  readonly sizeY: number
  readonly sizeZ: number
}

/** @deprecated  */
export interface ComputedWorldSize extends WorldSize {
  readonly totalBlocks: number
  readonly blocksPerY: number
  readonly chunksSizeX: number
  readonly chunksSizeZ: number
}

export class World {
  private constructor(
    public readonly sizeLevel: WorldSizeLevel,
    public readonly rawBlockData: Uint8Array,
    public readonly rawHeightData: Uint8ClampedArray,
    public readonly chunkModificationIds: Uint16Array,
    public readonly isNonUpdatable: boolean,
  ) {}

  public static createEmpty(sizeLevel: WorldSizeLevel): World {
    const numberOfChunks = sizeLevel * sizeLevel
    const numerOfBlocksPerChunk = GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE
    const numberOfBlocksTotal = numberOfChunks * numerOfBlocksPerChunk

    const blockData = new Uint8Array(createNewBuffer(numberOfBlocksTotal * Uint8Array.BYTES_PER_ELEMENT))
    const heightData = new Uint8ClampedArray(createNewBuffer(numberOfBlocksTotal * Uint8Array.BYTES_PER_ELEMENT))
    const chunkModificationIds = new Uint16Array(createNewBuffer(numberOfChunks * Uint16Array.BYTES_PER_ELEMENT))

    return new World(sizeLevel, blockData, heightData, chunkModificationIds, false)
  }

  public static fromReceived(object: any): World {
    const size = object.size

    const blockData = new Uint8Array(object.blocks)
    const heightData = new Uint8ClampedArray(object.height)
    const chunkModificationIds = new Uint16Array(object.chunkModificationIds)

    return new World(size, blockData, heightData, chunkModificationIds, true)
  }

  public static deserialize(object: any): World {
    const sizeLevel = object['size']

    const numberOfChunks = sizeLevel * sizeLevel

    const blockData = decodeArray(object['blocks'], true, Uint8Array)
    const heightData = decodeArray(object['heights'], true, Uint8ClampedArray)
    const chunkModificationIds = new Uint16Array(createNewBuffer(numberOfChunks * Uint16Array.BYTES_PER_ELEMENT))

    const world = new World(sizeLevel, blockData, heightData, chunkModificationIds, false)
    return world
  }

  public static copyFragment(
    from: World,
    to: World,
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    sizeX: number,
    sizeZ: number,
  ): void {
    if (from === to) throw new Error('Cannot copy to self')

    if (to.isNonUpdatable) throw new Error('Destination is readonly')

    const toSize = to.sizeLevel * GENERIC_CHUNK_SIZE
    const fromSize = from.sizeLevel * GENERIC_CHUNK_SIZE
    const toRawData = to.rawBlockData
    const fromRawData = from.rawBlockData
    const fromRawHeightData = from.rawHeightData
    const toRawHeightData = to.rawHeightData

    if (
      fromX !== (fromX | 0) ||
      fromX < 0 ||
      fromX >= fromSize ||
      fromZ !== (fromZ | 0) ||
      fromZ < 0 ||
      fromZ >= fromSize ||
      toX !== (toX | 0) ||
      toX < 0 ||
      toX + sizeX > toSize ||
      toZ !== (toZ | 0) ||
      toZ < 0 ||
      toZ + sizeZ > toSize ||
      sizeX !== (sizeX | 0) ||
      sizeX < 0 ||
      sizeZ !== (sizeZ | 0) ||
      sizeZ < 0
    )
      throw new Error('Invalid arguments')

    for (let x = 0; x < sizeX; x++)
      for (let z = 0; z < sizeZ; z++) {
        toRawData[(toX + x) * toSize + (toZ + z)] = fromRawData[(fromX + x) * fromSize + (fromZ + z)]!
        toRawHeightData[(toZ + z) * toSize + (toX + x)] = fromRawHeightData[(fromZ + z) * fromSize + (fromX + x)]!
      }

    const chunkModificationIds = to.chunkModificationIds
    for (let i = 0, l = chunkModificationIds.length; i < l; i++) chunkModificationIds[i]!++
  }

  public pass(): unknown {
    return {
      size: this.sizeLevel,
      blocks: this.rawBlockData['buffer'],
      height: this.rawHeightData['buffer'],
      chunkModificationIds: this.chunkModificationIds['buffer'],
    }
  }

  public serialize(): any {
    return {
      'size': this.sizeLevel,
      'blocks': encodeArray(this.rawBlockData),
      'heights': encodeArray(this.rawHeightData),
    }
  }

  public getBlock(x: number, z: number): BlockId {
    this.validateCoords(x, z)
    const sizeX = this.sizeLevel * GENERIC_CHUNK_SIZE
    return this.rawBlockData[x * sizeX + z] as BlockId
  }

  /**
   * Caller needs to update `MetadataField.LastWorldChange`
   */
  public setBlock(x: number, z: number, block: BlockId) {
    if (this.isNonUpdatable) throw new Error('world is readonly')
    this.validateCoords(x, z)

    const size = this.sizeLevel * GENERIC_CHUNK_SIZE
    this.rawBlockData[x * size + z] = block

    // notify chunk and nearby chunks as well
    this.chunkModificationIds[
      (((x - 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z + 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
    this.chunkModificationIds[
      (((x - 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z - 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
    this.chunkModificationIds[
      (((x + 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z + 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
    this.chunkModificationIds[
      (((x + 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z - 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
  }

  /**
   * Caller needs to update `MetadataField.LastWorldChange`
   */
  public setHeight(x: number, z: number, height: number) {
    if (this.isNonUpdatable) throw new Error('world is readonly')
    this.validateCoords(x, z)

    const size = this.sizeLevel * GENERIC_CHUNK_SIZE
    this.rawHeightData[x * size + z] = height

    // notify chunk and nearby chunks as well
    this.chunkModificationIds[
      (((x - 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z + 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
    this.chunkModificationIds[
      (((x - 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z - 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
    this.chunkModificationIds[
      (((x + 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z + 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
    this.chunkModificationIds[
      (((x + 1) / GENERIC_CHUNK_SIZE) | 0) * this.sizeLevel + (((z - 1) / GENERIC_CHUNK_SIZE) | 0)
    ]!++
  }

  /**
   * Caller needs to update `MetadataField.LastWorldChange`
   */
  public replaceBlock(x: number, z: number, withBlock: BlockId, ifBlock: BlockId) {
    if (this.isNonUpdatable) throw new Error('world is readonly')

    this.validateCoords(x, z)
    const currentBlock = this.getBlock(x, z)
    if (currentBlock === ifBlock) this.setBlock(x, z, withBlock)
  }

  public getHighestBlockHeight(x: number, z: number): number {
    this.validateCoords(x, z)
    const size = this.sizeLevel * GENERIC_CHUNK_SIZE
    return this.rawHeightData[z * size + x]!
  }

  public getHighestBlockHeightSafe(x: number, z: number): number {
    const size = this.sizeLevel * GENERIC_CHUNK_SIZE
    if (x < 0 || x >= size || (x | 0) !== x || z < 0 || z >= size || (z | 0) !== z) return -1
    return this.rawHeightData[z * size + x]!
  }

  private validateCoords(x: number, z: number) {
    const size = this.sizeLevel * GENERIC_CHUNK_SIZE
    if (x < 0 || x >= size || (x | 0) !== x || z < 0 || z >= size || (z | 0) !== z)
      throw new Error(`Invalid coords ${x} ${z}`)
  }
}
