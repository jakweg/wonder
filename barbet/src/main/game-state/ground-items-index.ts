import { decodeArray, encodeArray } from '@utils/persistence/serializers'
import { createNewBuffer } from '@utils/shared-memory'
import { ItemType } from './items'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from '@game/world/size'

export class GroundItemsIndex {
  private constructor(
    private readonly isNonUpdatable: boolean,
    public readonly rawItemData: Uint8Array,
    private readonly buffer: SharedArrayBuffer,
    public readonly blocksPerAxis: number,
  ) {}

  public get lastDataChangeId(): number {
    return this.rawItemData[0]!
  }

  public static createNew(size: WorldSizeLevel): GroundItemsIndex {
    const blocksPerAxis = size * GENERIC_CHUNK_SIZE
    const buffer = createNewBuffer((blocksPerAxis * blocksPerAxis + 1) * Uint8Array.BYTES_PER_ELEMENT)

    const itemIds = new Uint8Array(buffer)
    return new GroundItemsIndex(false, itemIds, buffer, blocksPerAxis)
  }

  public static fromReceived(object: any): GroundItemsIndex {
    const blocksPerAxis = object.blocksPerAxis as number
    const buffer = object.buffer as SharedArrayBuffer

    const itemIds = new Uint8Array(buffer)
    return new GroundItemsIndex(true, itemIds, buffer, blocksPerAxis)
  }

  public static deserialize(object: any): GroundItemsIndex {
    const blocksPerAxis = object['blocksPerAxis']
    const index = object['index']

    const itemIds = decodeArray(index, true, Uint8Array)
    return new GroundItemsIndex(false, itemIds, itemIds['buffer'] as any, blocksPerAxis)
  }

  public pass(): unknown {
    return {
      blocksPerAxis: this.blocksPerAxis,
      buffer: this.buffer,
    }
  }

  public serialize(): any {
    return {
      'blocksPerAxis': this.blocksPerAxis,
      'index': encodeArray(this.rawItemData),
    }
  }

  public setItem(x: number, z: number, type: ItemType): void {
    if (this.isNonUpdatable) throw new Error('updates are locked')

    this.validateCoords(x, z)
    this.rawItemData[z * this.blocksPerAxis + x + 1] = type
    this.rawItemData[0]!++
  }

  public getItem(x: number, z: number): ItemType {
    if (this.areCoordsInvalid(x, z)) return ItemType.None
    return this.rawItemData[z * this.blocksPerAxis + x + 1]! as ItemType
  }

  private validateCoords(x: number, z: number): void {
    if (this.areCoordsInvalid(x, z)) throw new Error(`Invalid coords ${x} ${z}`)
  }

  private areCoordsInvalid(x: number, z: number) {
    return x < 0 || x >= this.blocksPerAxis || (x | 0) !== x || z < 0 || z >= this.blocksPerAxis || (z | 0) !== z
  }
}
