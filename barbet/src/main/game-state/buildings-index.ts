import { decodeArray, encodeArray } from '../util/persistance/serializers'
import { createNewBuffer } from '../util/shared-memory'
import { ItemType } from './world/item'
import { WorldSize } from './world/world'

/**
 * @deprecated
 */
export class BuildingsIndex {
	private constructor(public readonly rawBuildingData: Uint8Array,
	                    private readonly buffer: SharedArrayBuffer,
	                    public readonly sizeX: number,
	                    public readonly sizeZ: number) {
	}

	public get lastDataChangeId(): number {
		return this.rawBuildingData[0]!
	}

	public static createNew(size: WorldSize): BuildingsIndex {
		const {sizeX, sizeZ} = size
		const buffer = createNewBuffer((sizeX * sizeZ + 1) * Uint8Array.BYTES_PER_ELEMENT)

		const itemIds = new Uint8Array(buffer)
		return new BuildingsIndex(itemIds, buffer, sizeX, sizeZ)
	}


	public static fromReceived(object: any): BuildingsIndex {
		const sizeX = object['sizeX'] as number
		const sizeZ = object['sizeZ'] as number
		const buffer = object['buffer'] as SharedArrayBuffer

		const itemIds = new Uint8Array(buffer)
		return new BuildingsIndex(itemIds, buffer, sizeX, sizeZ)
	}

	public static deserialize(object: any): BuildingsIndex {
		const sizeX = object['sizeX']
		const sizeZ = object['sizeZ']
		const index = object['index']

		const itemIds = decodeArray(index, true, Uint8Array)
		return new BuildingsIndex(itemIds, itemIds['buffer'] as SharedArrayBuffer, sizeX, sizeZ)
	}

	public pass(): unknown {
		return {
			'sizeX': this.sizeX,
			'sizeZ': this.sizeZ,
			'buffer': this.buffer,
		}
	}

	public serialize(): any {
		return {
			'sizeX': this.sizeX,
			'sizeZ': this.sizeZ,
			'index': encodeArray(this.rawBuildingData),
		}
	}

	public setItem(x: number, z: number, type: ItemType): void {
		this.validateCoords(x, z)
		this.rawBuildingData[z * this.sizeX + x + 1] = type
		this.rawBuildingData[0]++
	}

	public getItem(x: number, z: number): ItemType {
		this.validateCoords(x, z)
		return this.rawBuildingData[z * this.sizeX + x + 1]! as ItemType
	}

	private validateCoords(x: number, z: number): void {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
