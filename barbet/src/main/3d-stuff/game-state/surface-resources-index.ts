import { createNewBuffer } from '../../util/shared-memory'
import { SurfaceResourceType } from '../world/surface-resource'
import { ComputedWorldSize } from '../world/world'

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

	public static fromReceived(object: any): SurfaceResourcesIndex {
		if (object['type'] !== 'surface-index') throw new Error('Invalid object')
		const buffer = object['buffer'] as SharedArrayBuffer
		const rawIndex = new Uint8Array(buffer)

		return new SurfaceResourcesIndex(object['sizes'][0], object['sizes'][1], buffer, rawIndex)
	}

	public pass(): unknown {
		return {
			type: 'surface-index',
			buffer: this.buffer,
			sizes: [this.sizeX, this.sizeZ],
		}
	}


	public setResource(x: number, z: number, type: SurfaceResourceType): void {
		this.validateCoords(x, z)
		this.rawData[z * this.sizeX + x + 1] = type
		this.rawData[0]++
	}

	public getResource(x: number, z: number): SurfaceResourceType {
		this.validateCoords(x, z)
		return this.rawData[z * this.sizeX + x + 1]! as SurfaceResourceType
	}

	private validateCoords(x: number, z: number): void {
		if (x < 0 || x >= this.sizeX || (x | 0) !== x
			|| z < 0 || z >= this.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
