import { decodeArray, encodeArray } from '@utils/persistence/serializers'
import { createNewBuffer } from '@utils/shared-memory'
import { SurfaceResourceType } from './index'
import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from '@game/world/size'

export const MASK_RESOURCE_TYPE = 0b00011111
export const AMOUNT_SHIFT_BITS = 5
export const MASK_AMOUNT = 0b111 << AMOUNT_SHIFT_BITS

export class SurfaceResourcesIndex {
  constructor(
    private readonly isNonUpdatable: boolean,
    public readonly blocksPerAxis: number,
    private readonly buffer: SharedArrayBuffer,
    public readonly rawData: Uint8Array,
  ) {}

  public get lastDataChangeId(): number {
    return this.rawData[0]!
  }

  public static createNew(size: WorldSizeLevel): SurfaceResourcesIndex {
    const blocksPerAxis = size * GENERIC_CHUNK_SIZE
    const buffer = createNewBuffer(blocksPerAxis * Uint8Array.BYTES_PER_ELEMENT + 1)
    const rawIndex = new Uint8Array(buffer)

    return new SurfaceResourcesIndex(false, blocksPerAxis, buffer, rawIndex)
  }

  public static deserialize(object: any): SurfaceResourcesIndex {
    const blocksPerAxis = object['blocksPerAxis']
    const index = object['index']

    const rawIndex = decodeArray(index, true, Uint8Array)
    return new SurfaceResourcesIndex(false, blocksPerAxis, rawIndex['buffer'] as any, rawIndex)
  }

  public static fromReceived(object: any): SurfaceResourcesIndex {
    const buffer = object.buffer as SharedArrayBuffer
    const rawIndex = new Uint8Array(buffer)

    return new SurfaceResourcesIndex(true, object.blocksPerAxis, buffer, rawIndex)
  }

  public pass(): unknown {
    return {
      buffer: this.buffer,
      blocksPerAxis: this.blocksPerAxis,
    }
  }

  public serialize(): any {
    return {
      'blocksPerAxis': this.blocksPerAxis,
      'index': encodeArray(this.rawData),
    }
  }

  public setResource(x: number, z: number, type: SurfaceResourceType, amount: number): void {
    if (this.isNonUpdatable) throw new Error('updates are locked')

    this.validateCoords(x, z)
    const index = z * this.blocksPerAxis + x + 1
    if (type === SurfaceResourceType.None) this.rawData[index] = SurfaceResourceType.None
    else {
      if (amount !== (amount | 0) || amount <= 0 || amount - 1 > 0b111)
        throw new Error(`Invalid resource amount ${amount}`)
      this.rawData[index] = (type & MASK_RESOURCE_TYPE) | ((amount - 1) << AMOUNT_SHIFT_BITS)
    }
    this.rawData[0]!++
  }

  public extractSingleResource(x: number, z: number): SurfaceResourceType {
    if (this.isNonUpdatable) throw new Error('updates are locked')

    this.validateCoords(x, z)
    const raw = this.rawData[z * this.blocksPerAxis + x + 1]!
    const type = raw & (MASK_RESOURCE_TYPE as SurfaceResourceType)
    const amount = (raw & MASK_AMOUNT) >> AMOUNT_SHIFT_BITS
    if (type === SurfaceResourceType.None) return SurfaceResourceType.None

    if (amount === 0) this.rawData[z * this.blocksPerAxis + x + 1] = SurfaceResourceType.None
    else this.rawData[z * this.blocksPerAxis + x + 1] = type | ((amount - 1) << AMOUNT_SHIFT_BITS)

    this.rawData[0]!++
    return type
  }

  private validateCoords(x: number, z: number): void {
    if (x < 0 || x >= this.blocksPerAxis || (x | 0) !== x || z < 0 || z >= this.blocksPerAxis || (z | 0) !== z)
      throw new Error(`Invalid coords ${x} ${z}`)
  }
}
