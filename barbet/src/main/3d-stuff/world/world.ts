import { AIR_ID, BlockId } from './block'

export interface WorldSize {
	readonly sizeX: number,
	readonly sizeY: number,
	readonly sizeZ: number
}

export interface ComputedWorldSize extends WorldSize {
	readonly totalBlocks: number
	readonly blocksPerY: number
}

export class World {
	private constructor(
		public readonly size: ComputedWorldSize,
		public readonly rawBlockData: Uint8Array,
	) {
	}

	public static createEmpty(sizeX: number,
	                          sizeY: number,
	                          sizeZ: number,
	                          fillWith: BlockId = AIR_ID): World {
		const blocksPerY = sizeX * sizeZ
		const totalBlocks = sizeY * blocksPerY

		const size = {sizeX, sizeY, sizeZ, totalBlocks, blocksPerY}
		const blockData = new Uint8Array(totalBlocks)

		// by default all content is 0 so no need to reset that
		if (fillWith !== 0)
			blockData.fill(fillWith)

		return new World(size, blockData)
	}

	public setBlock(x: number, y: number, z: number, blockId: BlockId) {
		this.validateCoords(x, y, z)
		this.rawBlockData[y * this.size.blocksPerY + x * this.size.sizeX + z] = blockId
	}

	public getHighestBlockHeight(x: number, z: number): number {
		this.validateCoords(x, 0, z)
		const blocksPerY = this.size.blocksPerY
		const sizeX = this.size.sizeX
		for (let y = this.size.sizeY - 1; y >= 0; y--) {
			if (this.rawBlockData[y * blocksPerY + x * sizeX + z] !== AIR_ID)
				return y
		}
		return -1
	}

	private validateCoords(x: number, y: number, z: number) {
		if (x < 0 || x >= this.size.sizeX || (x | 0) !== x
			|| y < 0 || y >= this.size.sizeY || (y | 0) !== y
			|| z < 0 || z >= this.size.sizeZ || (z | 0) !== z)
			throw new Error(`Invalid coords ${x} ${y} ${z}`)
	}
}
