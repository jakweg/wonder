export enum BlockId {
	Air,
	Stone,
	Grass,
	Sand,
	Snow,
	Water,
	Ice,
}

export interface BlockType {
	/** must be between 0 and 255 */
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
	{numericId: BlockId.Stone, colorR: 0.415625, colorG: 0.41171875, colorB: 0.41171875},
	{numericId: BlockId.Grass, colorR: 0.41015625, colorG: 0.73046875, colorB: 0.2578125},
	{numericId: BlockId.Sand, colorR: 0.859375, colorG: 0.81640625, colorB: 0.6484375},
	{numericId: BlockId.Snow, colorR: 0.95, colorG: 0.95, colorB: 0.95},
	{numericId: BlockId.Water, colorR: 0.21875, colorG: 0.4921875, colorB: 0.9140625},
	{numericId: BlockId.Ice, colorR: 0.5625, colorG: 0.70703125, colorB: 0.98046875},
]

Object.freeze(allBlocks)
for (const b of allBlocks) Object.freeze(b)


export const AIR = allBlocks[BlockId.Air]!
export const AIR_ID: BlockId = BlockId.Air
