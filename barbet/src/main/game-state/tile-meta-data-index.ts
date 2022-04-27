import { WalkableTester } from '../util/path-finder'
import { decodeArray, encodeArray } from '../util/persistance/serializers'
import { createNewBuffer } from '../util/shared-memory'

const enum TileFlag {
	NoFlags = 0,
	HasBuilding,
}

export class TileMetaDataIndex {
	private constructor(
		private readonly isNonUpdatable: boolean,
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
		return new TileMetaDataIndex(false, sizeX, sizeZ, rawHeightData, tileFlags)
	}

	public static deserialize(data: any,
	                          rawHeightData: Uint8ClampedArray): TileMetaDataIndex {
		return new TileMetaDataIndex(false, data['sizeX'], data['sizeZ'], rawHeightData,
			decodeArray(data['tileFlags'], true, Uint8Array))
	}

	public static fromReceived(object: any): TileMetaDataIndex {
		return new TileMetaDataIndex(true, object.sizeX, object.sizeZ, object.heightIndex, object.tileFlags)
	}

	public serialize(): unknown {
		return {
			'sizeX': this.sizeX,
			'sizeZ': this.sizeZ,
			'tileFlags': encodeArray(this.tileFlags),
		}
	}

	public pass(): unknown {
		return {
			sizeX: this.sizeX,
			sizeZ: this.sizeZ,
			heightIndex: this.heightIndex,
			tileFlags: this.tileFlags,
		}
	}
	public createWalkableTester(unitY: number): WalkableTester {
		const expectedHeight = unitY -1
		return (x, z) => {
			if (!this.areCoordsValid(x, z))
				return false

			const index = x + z * this.sizeX
			const height = this.heightIndex[index]
			if (height !== expectedHeight)
				return false

			const flags = this.tileFlags[index]! as TileFlag

			return flags === TileFlag.NoFlags
		}
	}

	public canPlaceBuilding(x: number, z: number): boolean {
		if (!this.areCoordsValid(x, z))
			return false
		return this.tileFlags[x + z * this.sizeX]! === TileFlag.NoFlags
	}

	public setBuildingPlacedAt(x: number, z: number): void {
		this.addFlagForTile(x, z, TileFlag.HasBuilding)
	}

	private addFlagForTile(x: number, z: number, flag: TileFlag) {
		if (this.isNonUpdatable)
			throw new Error('updates are locked')

		this.validateCoords(x, z)
		this.tileFlags[x + z * this.sizeX] |= flag
	}

	private validateCoords(x: number, z: number): void {
		if (!this.areCoordsValid(x, z))
			throw new Error(`Invalid coords ${x} ${z}`)
	}

	private areCoordsValid(x: number, z: number) {
		return !(x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
	}
}
