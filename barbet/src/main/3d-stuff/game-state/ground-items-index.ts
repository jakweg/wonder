import { ItemType } from '../world/item'
import { WorldSize } from '../world/world'


export class GroundItemsIndex {
	public lastDataChangeId: number = 0

	private constructor(public readonly rawItemData: Uint8Array,
	                    private readonly buffer: SharedArrayBuffer,
	                    public readonly sizeX: number,
	                    public readonly sizeZ: number) {
	}

	public static createNew(size: WorldSize) {
		const {sizeX, sizeZ} = size
		const buffer = new SharedArrayBuffer(sizeX * sizeZ * Uint8Array.BYTES_PER_ELEMENT)

		const itemIds = new Uint8Array(buffer)
		return new GroundItemsIndex(itemIds, buffer, sizeX, sizeZ)
	}


	public static fromReceived(object: any) {
		if (object['type'] !== 'ground-items-index') throw new Error('Invalid object')
		const sizeX = object['sizeX'] as number
		const sizeZ = object['sizeZ'] as number
		const buffer = object['buffer'] as SharedArrayBuffer

		const itemIds = new Uint8Array(buffer)
		return new GroundItemsIndex(itemIds, buffer, sizeX, sizeZ)
	}

	public pass(): unknown {
		return {
			type: 'ground-items-index',
			sizeX: this.sizeX,
			sizeZ: this.sizeZ,
			buffer: this.buffer,
		}
	}

	public setItem(x: number, z: number, type: ItemType): void {
		this.validateCoords(x, z)
		this.rawItemData[z * this.sizeX + x] = type
		this.lastDataChangeId++
	}

	public getItem(x: number, z: number): ItemType {
		this.validateCoords(x, z)
		return this.rawItemData[z * this.sizeX + x]! as ItemType
	}

	private validateCoords(x: number, z: number): void {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
