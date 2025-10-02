import { GENERIC_CHUNK_SIZE, WorldSizeLevel } from '@game/world/size'
import { WalkableTester } from '@utils/path-finder'
import { decodeArray, encodeArray } from '@utils/persistence/serializers'
import { createNewBuffer } from '@utils/shared-memory'

const enum TileFlag {
  NoFlags = 0,
  HasBuilding = 0b0000_0001,
}

export class TileMetaDataIndex {
  private constructor(
    private readonly isNonUpdatable: boolean,
    private readonly blocksPerAxis: number,
    private readonly heightIndex: Uint8ClampedArray,
    private readonly tileFlags: Uint8Array,
  ) {}

  public static createNew(size: WorldSizeLevel, rawHeightData: Uint8ClampedArray): TileMetaDataIndex {
    const blocksPerAxis = size * GENERIC_CHUNK_SIZE
    const tileFlags = new Uint8Array(createNewBuffer(blocksPerAxis * blocksPerAxis * Uint8Array.BYTES_PER_ELEMENT))
    return new TileMetaDataIndex(false, blocksPerAxis, rawHeightData, tileFlags)
  }

  public static deserialize(data: any, rawHeightData: Uint8ClampedArray): TileMetaDataIndex {
    return new TileMetaDataIndex(
      false,
      data['blocksPerAxis'],
      rawHeightData,
      decodeArray(data['tileFlags'], true, Uint8Array),
    )
  }

  public static fromReceived(object: any): TileMetaDataIndex {
    return new TileMetaDataIndex(true, object.blocksPerAxis, object.heightIndex, object.tileFlags)
  }

  public serialize(): unknown {
    return {
      'blocksPerAxis': this.blocksPerAxis,
      'tileFlags': encodeArray(this.tileFlags),
    }
  }

  public pass(): unknown {
    return {
      blocksPerAxis: this.blocksPerAxis,
      heightIndex: this.heightIndex,
      tileFlags: this.tileFlags,
    }
  }
  public createWalkableTester(unitY: number): WalkableTester {
    const expectedHeight = unitY - 1
    return (x, z) => {
      if (!this.areCoordsValid(x, z)) return false

      const index = x + z * this.blocksPerAxis
      const height = this.heightIndex[index]
      if (height !== expectedHeight) return false

      const flags = this.tileFlags[index]! as TileFlag

      return flags === TileFlag.NoFlags
    }
  }

  public canPlaceBuilding(x: number, z: number): boolean {
    if (!this.areCoordsValid(x, z)) return false
    return this.tileFlags[x + z * this.blocksPerAxis]! === TileFlag.NoFlags
  }

  public setBuildingPlacedAt(x: number, z: number): void {
    this.addFlagForTile(x, z, TileFlag.HasBuilding)
  }

  private addFlagForTile(x: number, z: number, flag: TileFlag) {
    if (this.isNonUpdatable) throw new Error('updates are locked')

    this.validateCoords(x, z)
    this.tileFlags[x + z * this.blocksPerAxis]! |= flag
  }

  private validateCoords(x: number, z: number): void {
    if (!this.areCoordsValid(x, z)) throw new Error(`Invalid coords ${x} ${z}`)
  }

  private areCoordsValid(x: number, z: number) {
    return !(x < 0 || x >= this.blocksPerAxis || (x | 0) !== x || z < 0 || z >= this.blocksPerAxis || (z | 0) !== z)
  }
}
