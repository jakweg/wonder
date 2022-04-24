import { decodeArray, encodeArray } from '../util/persistance/serializers'
import { createNewBuffer } from '../util/shared-memory'
import { ItemType } from './world/item'
import { WorldSize } from './world/world'


export class GroundItemsIndex {
	private constructor(
		private readonly isNonUpdatable: boolean,
		public readonly rawItemData: Uint8Array,
		private readonly buffer: SharedArrayBuffer,
		public readonly sizeX: number,
		public readonly sizeZ: number) {
	}

	public get lastDataChangeId(): number {
		return this.rawItemData[0]!
	}

	public static createNew(size: WorldSize): GroundItemsIndex {
		const {sizeX, sizeZ} = size
		const buffer = createNewBuffer((sizeX * sizeZ + 1) * Uint8Array.BYTES_PER_ELEMENT)

		const itemIds = new Uint8Array(buffer)
		return new GroundItemsIndex(false, itemIds, buffer, sizeX, sizeZ)
	}


	public static fromReceived(object: any): GroundItemsIndex {
		const sizeX = object.sizeX as number
		const sizeZ = object.sizeZ as number
		const buffer = object.buffer as SharedArrayBuffer

		const itemIds = new Uint8Array(buffer)
		return new GroundItemsIndex(true, itemIds, buffer, sizeX, sizeZ)
	}

	public static deserialize(object: any): GroundItemsIndex {
		const sizeX = object['sizeX']
		const sizeZ = object['sizeZ']
		const index = object['index']

		const itemIds = decodeArray(index, true, Uint8Array)
		return new GroundItemsIndex(false, itemIds, itemIds['buffer'] as SharedArrayBuffer, sizeX, sizeZ)
	}

	public pass(): unknown {
		return {
			sizeX: this.sizeX,
			sizeZ: this.sizeZ,
			buffer: this.buffer,
		}
	}

	public serialize(): any {
		return {
			'sizeX': this.sizeX,
			'sizeZ': this.sizeZ,
			'index': encodeArray(this.rawItemData),
		}
	}

	public setItem(x: number, z: number, type: ItemType): void {
		if (this.isNonUpdatable)
			throw new Error('updates are locked')

		this.validateCoords(x, z)
		this.rawItemData[z * this.sizeX + x + 1] = type
		this.rawItemData[0]++
	}

	public getItem(x: number, z: number): ItemType {
		if (this.areCoordsInvalid(x, z))
			return ItemType.None
		return this.rawItemData[z * this.sizeX + x + 1]! as ItemType
	}

	private validateCoords(x: number, z: number): void {
		if (this.areCoordsInvalid(x, z))
			throw new Error(`Invalid coords ${x} ${z}`)
	}

	private areCoordsInvalid(x: number, z: number) {
		return x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z
	}
}
