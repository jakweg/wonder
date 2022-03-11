import { createNewBuffer } from '../../util/shared-memory'
import { AIR_ID, BlockId } from './block'

export const WORLD_CHUNK_SIZE = 32

export interface WorldSize {
	readonly sizeX: number,
	readonly sizeY: number,
	readonly sizeZ: number
}

export interface ComputedWorldSize extends WorldSize {
	readonly totalBlocks: number
	readonly blocksPerY: number
	readonly chunksSizeX: number
	readonly chunksSizeZ: number
}

export class World {
	public lastChangeId: number = 0

	private constructor(
		public readonly size: ComputedWorldSize,
		public readonly rawBlockData: Uint8Array,
		public readonly rawHeightData: Uint8ClampedArray,
		public readonly chunkModificationIds: Uint16Array,
		public readonly buffers: SharedArrayBuffer[],
	) {
	}

	public static createEmpty(sizeX: number,
	                          sizeY: number,
	                          sizeZ: number,
	                          fillWith: BlockId = AIR_ID): World {
		const blocksPerY = sizeX * sizeZ
		const totalBlocks = sizeY * blocksPerY
		const chunksSizeX = Math.ceil(sizeX / WORLD_CHUNK_SIZE)
		const chunksSizeZ = Math.ceil(sizeZ / WORLD_CHUNK_SIZE)

		const size = {sizeX, sizeY, sizeZ, totalBlocks, blocksPerY, chunksSizeX, chunksSizeZ}
		const buffers = [
			createNewBuffer(totalBlocks * Uint8Array.BYTES_PER_ELEMENT),
			createNewBuffer(blocksPerY * Uint8ClampedArray.BYTES_PER_ELEMENT),
			createNewBuffer(chunksSizeX * chunksSizeZ * Uint16Array.BYTES_PER_ELEMENT),
		]


		const blockData = new Uint8Array(buffers[0]!)
		const heightData = new Uint8ClampedArray(buffers[1]!)

		// by default all content is 0 so no need to reset that
		if (fillWith !== 0) {
			blockData.fill(fillWith)
			heightData.fill(sizeY - 1)
		}

		const chunkModificationIds = new Uint16Array(buffers[2]!)

		return new World(size, blockData, heightData, chunkModificationIds, buffers)
	}

	public static fromReceived(object: any) {
		if (object['type'] !== 'world') throw new Error('Invalid world object')
		const size = object['size'] as ComputedWorldSize
		const buffers = object['buffers'] as SharedArrayBuffer[]

		const blockData = new Uint8Array(buffers[0]!)
		const heightData = new Uint8ClampedArray(buffers[1]!)
		const chunkModificationIds = new Uint16Array(buffers[2]!)

		return new World(size, blockData, heightData, chunkModificationIds, buffers)
	}

	public pass(): unknown {
		return {
			type: 'world',
			size: this.size,
			buffers: this.buffers,
		}
	}

	public extractTo(other: World, sx: number, sy: number, sz: number): void {
		if (other === this)
			throw new Error('Cannot extract to self')
		this.validateCoords(sx, sy, sz)
		const {sizeX, sizeY, sizeZ, blocksPerY} = other.size

		if (this.size.sizeX - sx < sizeX
			|| this.size.sizeY - sy < sizeY
			|| this.size.sizeZ - sz < sizeZ)
			throw new Error('Invalid sizes')


		const mySizeX = this.size.sizeX
		const myBlocksPerY = this.size.blocksPerY
		const myRawData = this.rawBlockData
		const otherRawData = other.rawBlockData
		const myHeightData = this.rawHeightData
		const otherHeightData = other.rawHeightData

		other.lastChangeId++
		for (let i = other.chunkModificationIds.length - 1; i >= 0; i--)
			other.chunkModificationIds[i]++

		for (let y = 0; y < sizeY; y++) {
			for (let x = 0; x < sizeX; x++) {
				for (let z = 0; z < sizeZ; z++) {
					otherRawData[y * blocksPerY + x * sizeX + z] = myRawData[(y + sy) * myBlocksPerY + (x + sx) * mySizeX + (z + sz)]!
					otherHeightData[x * sizeX + z] = myHeightData[(x + sx) * mySizeX + (z + sz)]! - sy
				}
			}
		}
	}

	public copyFrom(other: World, sx: number, sy: number, sz: number): void {
		if (other === this)
			throw new Error('Cannot copy to self')
		this.validateCoords(sx, sy, sz)
		const {sizeX, sizeY, sizeZ, blocksPerY} = other.size

		if (this.size.sizeX - sx < sizeX
			|| this.size.sizeY - sy < sizeY
			|| this.size.sizeZ - sz < sizeZ)
			throw new Error('Invalid sizes')


		const myBlocksPerY = this.size.blocksPerY
		const mySizeX = this.size.sizeX
		const myRawData = this.rawBlockData
		const otherRawData = other.rawBlockData
		const otherHeightData = other.rawHeightData
		const myHeightData = this.rawHeightData

		this.lastChangeId++
		for (let i = this.chunkModificationIds.length - 1; i >= 0; i--)
			this.chunkModificationIds[i]++

		for (let y = 0; y < sizeY; y++) {
			for (let x = 0; x < sizeX; x++) {
				for (let z = 0; z < sizeZ; z++) {
					myRawData[(y + sy) * myBlocksPerY + (x + sx) * mySizeX + (z + sz)] = otherRawData[y * blocksPerY + x * sizeX + z]!
					myHeightData[(x + sx) * mySizeX + (z + sz)] = otherHeightData[x * sizeX + z]! + sy
				}
			}
		}
	}

	public setBlock(x: number, y: number, z: number, blockId: BlockId) {
		this.validateCoords(x, y, z)
		const sizeX = this.size.sizeX
		const blocksPerY = this.size.blocksPerY
		this.rawBlockData[y * blocksPerY + x * sizeX + z] = blockId
		const previousTop = this.rawHeightData[z * sizeX + x]!
		if (y >= previousTop)
			if (blockId !== BlockId.Air)
				this.rawHeightData[z * sizeX + x]! = y
			else {
				let top = y
				for (; top >= previousTop; top--) {
					if (this.rawBlockData[top * blocksPerY + x * sizeX + z] !== AIR_ID)
						break
				}
				this.rawHeightData[z * sizeX + x]! = top
			}

		this.lastChangeId++
		this.chunkModificationIds[((z / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + (x / WORLD_CHUNK_SIZE | 0)]++
		// notify nearby chunks if affected
		this.chunkModificationIds[(((z - 1) / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + (x / WORLD_CHUNK_SIZE | 0)]++
		this.chunkModificationIds[(((z + 1) / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + (x / WORLD_CHUNK_SIZE | 0)]++
		this.chunkModificationIds[((z / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + ((x - 1) / WORLD_CHUNK_SIZE | 0)]++
		this.chunkModificationIds[((z / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + ((x + 1) / WORLD_CHUNK_SIZE | 0)]++
	}

	public getLastChunkModificationId(x: number, z: number): number {
		this.validateChunkCoords(x, z)
		return this.chunkModificationIds[z * this.size.chunksSizeX + x]!
	}

	public recalculateHeightIndex(): void {
		const blocksPerY = this.size.blocksPerY
		const sizeX = this.size.sizeX
		for (let x = 0; x < sizeX; x++) {
			for (let z = 0; z < this.size.sizeZ; z++) {
				let y = this.size.sizeY - 1
				for (; y >= 0; y--)
					if (this.rawBlockData[y * blocksPerY + x * sizeX + z] !== AIR_ID)
						break

				this.rawHeightData[z * sizeX + x]! = y
			}
		}
	}

	public getHighestBlockHeight(x: number, z: number): number {
		this.validateCoords(x, 0, z)
		const sizeX = this.size.sizeX
		return this.rawHeightData[z * sizeX + x]!
	}

	private validateCoords(x: number, y: number, z: number) {
		if (x < 0 || x >= this.size.sizeX || (x | 0) !== x
			|| y < 0 || y >= this.size.sizeY || (y | 0) !== y
			|| z < 0 || z >= this.size.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${y} ${z}`)
	}

	private validateChunkCoords(x: number, z: number) {
		if (x < 0 || x >= this.size.chunksSizeX || (x | 0) !== x
			|| z < 0 || z >= this.size.chunksSizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${z}`)
	}
}
