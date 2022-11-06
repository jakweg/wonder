import { BlockId } from './block'

export const enum BiomeId {
  Void,
  Forest,
  Desert,
  Snowy,
}

export interface BiomeType {
  /** must be between 0 and 255 */
  readonly numericId: BiomeId

  readonly surfaceMaterialId: BlockId

  readonly underSurfaceMaterialId: BlockId

  readonly waterSurfaceMaterialId: BlockId
}

export const allBiomes: BiomeType[] = [
  {
    numericId: BiomeId.Void,
    surfaceMaterialId: BlockId.Air,
    underSurfaceMaterialId: BlockId.Air,
    waterSurfaceMaterialId: BlockId.Air,
  },
  {
    numericId: BiomeId.Forest,
    surfaceMaterialId: BlockId.Grass,
    underSurfaceMaterialId: BlockId.Stone,
    waterSurfaceMaterialId: BlockId.Water,
  },
  {
    numericId: BiomeId.Desert,
    surfaceMaterialId: BlockId.Sand,
    underSurfaceMaterialId: BlockId.Sand,
    waterSurfaceMaterialId: BlockId.Water,
  },
  {
    numericId: BiomeId.Snowy,
    surfaceMaterialId: BlockId.Snow,
    underSurfaceMaterialId: BlockId.Stone,
    waterSurfaceMaterialId: BlockId.Ice,
  },
]
