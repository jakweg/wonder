import { AIR, BlockType } from './block'

export interface WorldSize {
	readonly sizeX: number,
	readonly sizeY: number,
	readonly sizeZ: number
}

export interface ComputedWorldSize extends WorldSize {
	readonly totalBlocks: number
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
	                          fillWith: BlockType = AIR): World {
		const totalBlocks = sizeX * sizeY * sizeZ

		const size = {sizeX, sizeY, sizeZ, totalBlocks}
		const blockData = new Uint8Array(totalBlocks)

		// by default all content is 0 so no need to reset that
		if (fillWith.numericId !== 0)
			blockData.fill(fillWith.numericId)

		return new World(size, blockData)
	}
}
