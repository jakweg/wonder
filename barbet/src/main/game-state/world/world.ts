import { decodeArray, encodeArray } from '../../util/persistance/serializers'
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
	private constructor(
		public readonly size: ComputedWorldSize,
		public readonly rawBlockData: Uint8Array,
		public readonly rawHeightData: Uint8ClampedArray,
		public readonly chunkModificationIds: Uint16Array,
		public readonly buffers: SharedArrayBuffer[],
		public readonly isNonUpdatable: boolean,
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

		const size = { sizeX, sizeY, sizeZ, totalBlocks, blocksPerY, chunksSizeX, chunksSizeZ }
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

		return new World(size, blockData, heightData, chunkModificationIds, buffers, false)
	}

	public static fromReceived(object: any): World {
		const sizes = object.sizes
		const sizeX = sizes[0]
		const sizeY = sizes[1]
		const sizeZ = sizes[2]
		const blocksPerY = sizeX * sizeZ
		const totalBlocks = sizeY * blocksPerY
		const chunksSizeX = Math.ceil(sizeX / WORLD_CHUNK_SIZE)
		const chunksSizeZ = Math.ceil(sizeZ / WORLD_CHUNK_SIZE)

		const size: ComputedWorldSize = { sizeX, sizeY, sizeZ, totalBlocks, blocksPerY, chunksSizeX, chunksSizeZ }
		const buffers = object.buffers as SharedArrayBuffer[]

		const blockData = new Uint8Array(buffers[0]!)
		const heightData = new Uint8ClampedArray(buffers[1]!)
		const chunkModificationIds = new Uint16Array(buffers[2]!)

		return new World(size, blockData, heightData, chunkModificationIds, buffers, true)
	}

	public static deserialize(object: any): World {
		const sizes = object['sizes']
		const sizeX = sizes[0]
		const sizeY = sizes[1]
		const sizeZ = sizes[2]
		const blocks = object['blocks']

		const blocksPerY = sizeX * sizeZ
		const totalBlocks = sizeY * blocksPerY
		const chunksSizeX = Math.ceil(sizeX / WORLD_CHUNK_SIZE)
		const chunksSizeZ = Math.ceil(sizeZ / WORLD_CHUNK_SIZE)
		const size: ComputedWorldSize = { sizeX, sizeY, sizeZ, blocksPerY, totalBlocks, chunksSizeX, chunksSizeZ }

		const rawBlockData = decodeArray(blocks, true, Uint8Array)

		const buffers = [
			rawBlockData['buffer'] as SharedArrayBuffer,
			createNewBuffer(blocksPerY * Uint8ClampedArray.BYTES_PER_ELEMENT),
			createNewBuffer(chunksSizeX * chunksSizeZ * Uint16Array.BYTES_PER_ELEMENT),
		]

		const world = new World(size, rawBlockData, new Uint8ClampedArray(buffers[1]!), new Uint16Array(buffers[2]!), buffers, false)
		world.recalculateHeightIndex()
		return world
	}

	public static copyFragment(from: World, to: World,
		fromX: number, fromY: number, fromZ: number,
		toX: number, toY: number, toZ: number,
		sizeX: number, sizeY: number, sizeZ: number): void {
		if (from === to)
			throw new Error('Cannot copy to self')

		if (to.isNonUpdatable)
			throw new Error('Destination is readonly')

		const toSizeX = to.size.sizeX
		const fromSizeX = from.size.sizeX
		const toSizeZ = to.size.sizeZ
		const fromSizeZ = from.size.sizeZ
		const toRawData = to.rawBlockData
		const fromRawData = from.rawBlockData
		const fromBlocksY = from.size.blocksPerY
		const toBlocksY = to.size.blocksPerY
		const fromRawHeightData = from.rawHeightData
		const toRawHeightData = to.rawHeightData
		const heightDelta = toY - fromY

		if (
			fromX !== (fromX | 0) || fromX < 0 || fromX >= fromSizeX
			|| fromY !== (fromY | 0) || fromY < 0 || fromY >= from.size.sizeY
			|| fromZ !== (fromZ | 0) || fromZ < 0 || fromZ >= fromSizeZ

			|| toX !== (toX | 0) || toX < 0 || (toX + sizeX) > toSizeX
			|| toY !== (toY | 0) || toY < 0 || (toY + sizeY) > to.size.sizeY
			|| toZ !== (toZ | 0) || toZ < 0 || (toZ + sizeZ) > toSizeZ

			|| sizeX !== (sizeX | 0) || sizeX < 0
			|| sizeY !== (sizeY | 0) || sizeY < 0
			|| sizeZ !== (sizeZ | 0) || sizeZ < 0
		) throw new Error('Invalid arguments')


		for (let y = 0; y < sizeY; y++)
			for (let x = 0; x < sizeX; x++)
				for (let z = 0; z < sizeZ; z++)
					toRawData[(toY + y) * toBlocksY + (toX + x) * toSizeZ + (toZ + z)] = fromRawData[(fromY + y) * fromBlocksY + (fromX + x) * fromSizeZ + (fromZ + z)]!


		for (let x = 0; x < sizeX; x++)
			for (let z = 0; z < sizeZ; z++)
				toRawHeightData[(toZ + z) * toSizeX + (toX + x)] = fromRawHeightData[(fromZ + z) * fromSizeX + (fromX + x)]! + heightDelta


		const chunkModificationIds = to.chunkModificationIds
		for (let i = 0, l = chunkModificationIds.length; i < l; i++)
			chunkModificationIds[i]++
	}


	public pass(): unknown {
		return {
			sizes: [this.size.sizeX, this.size.sizeY, this.size.sizeZ],
			buffers: this.buffers,
		}
	}

	public serialize(): any {
		return {
			'sizes': [this.size.sizeX, this.size.sizeY, this.size.sizeZ],
			'blocks': encodeArray(this.rawBlockData),
		}
	}

	public getBlock(x: number, y: number, z: number): BlockId {
		this.validateCoords(x, y, z)
		const sizeX = this.size.sizeX
		const blocksPerY = this.size.blocksPerY
		return this.rawBlockData[y * blocksPerY + x * sizeX + z] as BlockId
	}

	public setBlock(x: number, y: number, z: number, blockId: BlockId) {
		if (this.isNonUpdatable)
			throw new Error('world is readonly')

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

		this.chunkModificationIds[((z / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + (x / WORLD_CHUNK_SIZE | 0)]++
		// notify nearby chunks if affected
		this.chunkModificationIds[(((z - 1) / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + (x / WORLD_CHUNK_SIZE | 0)]++
		this.chunkModificationIds[(((z + 1) / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + (x / WORLD_CHUNK_SIZE | 0)]++
		this.chunkModificationIds[((z / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + ((x - 1) / WORLD_CHUNK_SIZE | 0)]++
		this.chunkModificationIds[((z / WORLD_CHUNK_SIZE) | 0) * this.size.chunksSizeX + ((x + 1) / WORLD_CHUNK_SIZE | 0)]++
	}

	public replaceBlock(x: number, y: number, z: number, withBlock: BlockId, ifBlock: BlockId) {
		if (this.isNonUpdatable)
			throw new Error('world is readonly')

		this.validateCoords(x, y, z)
		const sizeX = this.size.sizeX
		const blocksPerY = this.size.blocksPerY
		const currentBlock = this.rawBlockData[y * blocksPerY + x * sizeX + z]! as BlockId
		if (currentBlock === ifBlock)
			this.setBlock(x, y, z, withBlock)
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

	public getHighestBlockHeightSafe(x: number, z: number): number {
		const sizeX = this.size.sizeX
		const sizeZ = this.size.sizeZ
		if (x < 0 || x >= sizeX || (x | 0) !== x
			|| z < 0 || z >= sizeZ || (z | 0) !== z)
			return -1
		return this.rawHeightData[z * sizeX + x]!
	}

	private validateCoords(x: number, y: number, z: number) {
		if (x < 0 || x >= this.size.sizeX || (x | 0) !== x
			|| y < 0 || y >= this.size.sizeY || (y | 0) !== y
			|| z < 0 || z >= this.size.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${y} ${z}`)
	}
}
