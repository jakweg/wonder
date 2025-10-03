export const enum BlockId {
  Air,
  Stone,
  Grass,
  Sand,
  Snow,
  Water,
  Ice,
  Gravel,
}

export interface BlockType {
  /** must be between 0 and 255 */
  readonly numericId: BlockId

  /** 3 bytes encoded as rgb, leading byte is 0 */
  readonly color: number
}

export const allBlocks: BlockType[] = [
  { numericId: BlockId.Air, color: 0x000000 },
  { numericId: BlockId.Stone, color: 0x696868 },
  { numericId: BlockId.Grass, color: 0x68ba41 },
  { numericId: BlockId.Sand, color: 0xdbd0a5 },
  { numericId: BlockId.Snow, color: 0xf2f2f2 },
  { numericId: BlockId.Water, color: 0x377de9 },
  { numericId: BlockId.Ice, color: 0x8fb4fa },
  { numericId: BlockId.Gravel, color: 0x858180 },
]

/* @__PURE__ */ allBlocks.sort((a, b) => a.numericId - b.numericId)

export const AIR_ID: BlockId = BlockId.Air
