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
		public readonly rawHeightData: Uint8ClampedArray,
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
		const heightData = new Uint8ClampedArray(blocksPerY)

		// by default all content is 0 so no need to reset that
		if (fillWith !== 0) {
			blockData.fill(fillWith)
			heightData.fill(sizeY - 1)
		}

		return new World(size, blockData, heightData)
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
}
