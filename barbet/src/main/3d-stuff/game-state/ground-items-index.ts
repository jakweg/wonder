import { ItemType } from '../world/item'
import { WorldSize } from '../world/world'


export class GroundItemsIndex {
	public lastDataChangeId: number = 0

	private constructor(public readonly rawItemData: Uint8Array,
	                    public readonly sizeX: number,
	                    public readonly sizeZ: number) {
	}

	public static createNew(size: WorldSize) {
		const {sizeX, sizeZ} = size
		const itemIds = new Uint8Array(sizeX * sizeZ)
		return new GroundItemsIndex(itemIds, sizeX, sizeZ)
	}

	public setItem(x: number, z: number, type: ItemType): void {
		this.validateCoords(x, z)
		this.rawItemData[z * this.sizeX + x] = type
		this.lastDataChangeId++
	}

	private validateCoords(x: number, z: number): void {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
