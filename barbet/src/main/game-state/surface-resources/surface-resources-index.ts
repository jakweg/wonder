import { decodeArray, encodeArray } from '../../util/persistance/serializers'
import { createNewBuffer } from '../../util/shared-memory'
import { SurfaceResourceType } from '../world/surface-resource'
import { ComputedWorldSize } from '../world/world'

export const MASK_RESOURCE_TYPE = 0b00011111
export const AMOUNT_SHIFT_BITS = 5
export const MASK_AMOUNT = 0b111 << AMOUNT_SHIFT_BITS

export class SurfaceResourcesIndex {
	constructor(
		public readonly sizeX: number,
		public readonly sizeZ: number,
		private readonly buffer: SharedArrayBuffer,
		public readonly rawData: Uint8Array) {
	}

	public get lastDataChangeId(): number {
		return this.rawData[0]!
	}

	public static createNew(size: ComputedWorldSize): SurfaceResourcesIndex {
		const buffer = createNewBuffer(size.blocksPerY * Uint8Array.BYTES_PER_ELEMENT + 1)
		const rawIndex = new Uint8Array(buffer)

		return new SurfaceResourcesIndex(size.sizeX, size.sizeZ, buffer, rawIndex)
	}

	public static deserialize(object: any): SurfaceResourcesIndex {
		const sizeX = object['sizeX']
		const sizeZ = object['sizeZ']
		const index = object['index']

		const rawIndex = decodeArray(index, true, Uint8Array)
		return new SurfaceResourcesIndex(sizeX, sizeZ, rawIndex['buffer'] as SharedArrayBuffer, rawIndex)
	}

	public static fromReceived(object: any): SurfaceResourcesIndex {
		const buffer = object['buffer'] as SharedArrayBuffer
		const rawIndex = new Uint8Array(buffer)

		return new SurfaceResourcesIndex(object['sizes'][0], object['sizes'][1], buffer, rawIndex)
	}

	public pass(): unknown {
		return {
			'buffer': this.buffer,
			'sizes': [this.sizeX, this.sizeZ],
		}
	}

	public serialize(): any {
		return {
			'sizeX': this.sizeX,
			'sizeZ': this.sizeZ,
			'index': encodeArray(this.rawData),
		}
	}

	public setResource(x: number, z: number, type: SurfaceResourceType, amount: number): void {
		this.validateCoords(x, z)
		const index = z * this.sizeX + x + 1
		if (type === SurfaceResourceType.None)
			this.rawData[index] = SurfaceResourceType.None
		else {
			if (amount !== (amount | 0) || amount <= 0 || amount - 1 > 0b111)
				throw new Error(`Invalid resource amount ${amount}`)
			this.rawData[index] = (type & MASK_RESOURCE_TYPE) | ((amount - 1) << AMOUNT_SHIFT_BITS)
		}
		this.rawData[0]++
	}

	public extractSingleResource(x: number, z: number): SurfaceResourceType {
		this.validateCoords(x, z)
		const raw = this.rawData[z * this.sizeX + x + 1]!
		const type = raw & MASK_RESOURCE_TYPE as SurfaceResourceType
		const amount = ((raw & MASK_AMOUNT) >> AMOUNT_SHIFT_BITS)
		if (type === SurfaceResourceType.None)
			return SurfaceResourceType.None

		if (amount === 0)
			this.rawData[z * this.sizeX + x + 1] = SurfaceResourceType.None
		else
			this.rawData[z * this.sizeX + x + 1] = type | ((amount - 1) << AMOUNT_SHIFT_BITS)

		this.rawData[0]++
		return type
	}

	private validateCoords(x: number, z: number): void {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
