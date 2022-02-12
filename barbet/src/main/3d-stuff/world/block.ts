export enum BlockId {
	Air = 0,
	Stone = 1,
}

export interface BlockType {
	/**
	 * must be between 0 and 255
	 */
	readonly numericId: BlockId

	/** must be between 0 and 1 */
	readonly colorR: number
	/** must be between 0 and 1 */
	readonly colorG: number
	/** must be between 0 and 1 */
	readonly colorB: number
}


export const allBlocks: BlockType[] = [
	{numericId: BlockId.Air, colorR: 0, colorG: 0, colorB: 0},
	{numericId: BlockId.Stone, colorR: 0.415625, colorB: 0.41171875, colorG: 0.41171875},
]

Object.freeze(allBlocks)
for (const b of allBlocks) Object.freeze(b)


export const AIR = allBlocks[BlockId.Air]!
export const AIR_ID: BlockId = BlockId.Air
