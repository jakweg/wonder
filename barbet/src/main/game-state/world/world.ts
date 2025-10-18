import { decodeArray, encodeArray } from '@utils/persistence/serializers'
import { createNewBuffer } from '@utils/shared-memory'
import { BlockId } from './block'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from './size'

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
        to.setBlock_safe(toX + x, toZ + z, from.getBlock_safe(fromX + x, fromZ + z))
        to.setHeight_safe(toX + x, toZ + z, from.getHighestBlockHeight_safe(fromX + x, fromZ + z))
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

  public getBlock_safe(x: number, z: number): BlockId {
    this.validateCoords(x, z)
    return this.getBlock_unsafe(x, z)
  }

  public getBlock_unsafe(x: number, z: number): BlockId {
    const index = this.calculateIndexForPosition_unsafe(x, z)
    return this.rawBlockData[index] as BlockId
  }

  /**
   * Caller needs to update `MetadataField.LastWorldChange`
   */
  public setBlock_safe(x: number, z: number, block: BlockId) {
    if (this.isNonUpdatable) throw new Error('world is readonly')
    this.validateCoords(x, z)
    this.setBlock_unsafe(x, z, block)
  }

  /**
   * Caller needs to update `MetadataField.LastWorldChange`
   */
  public setBlock_unsafe(x: number, z: number, block: BlockId) {
    const index = this.calculateIndexForPosition_unsafe(x, z)
    this.rawBlockData[index] = block

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
  public setHeight_safe(x: number, z: number, height: number) {
    if (this.isNonUpdatable) throw new Error('world is readonly')
    if (height !== (height | 0) || height < 0 || height > 0xff) throw new Error()
    this.validateCoords(x, z)

    this.setHeight_unsafe(x, z, height)
  }

  /**
   * Caller needs to update `MetadataField.LastWorldChange`
   */
  public setHeight_unsafe(x: number, z: number, height: number) {
    const index = this.calculateIndexForPosition_unsafe(x, z)
    this.rawHeightData[index] = height

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
    const currentBlock = this.getBlock_safe(x, z)
    if (currentBlock === ifBlock) this.setBlock_safe(x, z, withBlock)
  }

  public getHighestBlockHeight_unsafe(x: number, z: number): number {
    const index = this.calculateIndexForPosition_unsafe(x, z)
    return this.rawHeightData[index]!
  }

  public getHighestBlockHeight_safe(x: number, z: number): number {
    if (!this.checkCoords(x, z)) throw new Error(`Invalid coords ${x} ${z}`)
    return this.getHighestBlockHeight_unsafe(x, z)
  }

  public getHighestBlockHeight_orElse(x: number, z: number, fallback: number): number {
    if (!this.checkCoords(x, z)) return fallback
    return this.getHighestBlockHeight_unsafe(x, z)
  }

  private checkCoords(x: number, z: number) {
    const size = this.sizeLevel * GENERIC_CHUNK_SIZE
    return !(x < 0 || x >= size || (x | 0) !== x || z < 0 || z >= size || (z | 0) !== z)
  }

  private validateCoords(x: number, z: number) {
    if (!this.checkCoords(x, z)) throw new Error(`Invalid coords ${x} ${z}`)
  }

  private calculateIndexForPosition_unsafe(x: number, z: number) {
    x |= 0
    z |= 0

    const chunkX = (x / GENERIC_CHUNK_SIZE) | 0
    const chunkZ = (z / GENERIC_CHUNK_SIZE) | 0

    const withinChunkX = x % GENERIC_CHUNK_SIZE | 0
    const withinChunkZ = z % GENERIC_CHUNK_SIZE | 0

    const chunkIndex = (((chunkZ * this.sizeLevel) | 0) + chunkX) | 0
    const withinChunkIndex = (((withinChunkZ * GENERIC_CHUNK_SIZE) | 0) + withinChunkX) | 0

    const absoluteIndex = chunkIndex * GENERIC_CHUNK_SIZE * GENERIC_CHUNK_SIZE + withinChunkIndex

    return absoluteIndex | 0
  }
}
