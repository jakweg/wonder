import { WalkableTester } from '../../util/path-finder'
import { decodeArray, encodeArray } from '../../util/persistance/serializers'
import { createNewBuffer } from '../../util/shared-memory'

const enum TileFlag {
	HasBuilding,
}

export class TileMetaDataIndex {
	private constructor(
		private readonly sizeX: number,
		private readonly sizeZ: number,
		private readonly heightIndex: Uint8ClampedArray,
		private readonly tileFlags: Uint8Array,
	) {
	}

	public static createNew(sizeX: number,
	                        sizeZ: number,
	                        rawHeightData: Uint8ClampedArray)
		: TileMetaDataIndex {
		const tileFlags = new Uint8Array(createNewBuffer(sizeX * sizeZ * Uint8Array.BYTES_PER_ELEMENT))
		return new TileMetaDataIndex(sizeX, sizeZ, rawHeightData, tileFlags)
	}

	public static deserialize(data: any,
	                          rawHeightData: Uint8ClampedArray): TileMetaDataIndex {
		return new TileMetaDataIndex(data['sizeX'], data['sizeZ'], rawHeightData,
			decodeArray(data['tileFlags'], true, Uint8Array))
	}

	public serialize(): unknown {
		return {
			'sizeX': this.sizeX,
			'sizeZ': this.sizeZ,
			'tileFlags': encodeArray(this.tileFlags),
		}
	}

	public readonly walkableTester: WalkableTester = (x, z) => {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			return false
		const index = x + z * this.sizeX
		const height = this.heightIndex[index]
		if (height !== 1)
			return false

		const flags = this.tileFlags[index]

		return flags === 0
	}

	private addFlagForTile(x: number, z: number, flag: TileFlag) {
		this.validateCoords(x, z)
		this.tileFlags[x + z * this.sizeX] |= flag
	}

	private validateCoords(x: number, z: number): void {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
