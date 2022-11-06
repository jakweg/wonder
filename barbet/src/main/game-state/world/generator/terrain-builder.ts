import { makeNoise2D } from '../../../../../../seampan/noise/2d'

const getBlockTypeByNoiseValue = (v: number): BlockType => {
  if (v < 0.04) return BlockType.DeepWater

  if (v < 0.08) return BlockType.Water

  if (v < 0.2) return BlockType.Sand

  if (v < 0.5) return BlockType.Grass

  if (v < 0.7) return BlockType.Stone

  return BlockType.Snow
}

enum BlockType {
  Air = 0,
  Snow,
  Stone,
  Grass,
  Sand,
  Water,
  DeepWater,
}

const getTopColorByBlock = (block: BlockType): [number, number, number] => {
  switch (block) {
    case BlockType.Stone:
      return [0.415625, 0.41171875, 0.41171875]
    case BlockType.Grass:
      return [0.41015625, 0.73046875, 0.2578125]
    case BlockType.Sand:
      return [0.859375, 0.81640625, 0.6484375]
    case BlockType.Water:
      return [0.21875, 0.4921875, 0.9140625]
    case BlockType.DeepWater:
      return [0.21875, 0.3421875, 0.8140625]
    case BlockType.Snow:
    default:
      return [1, 1, 1]
  }
}

const getSideColorByBlock = (block: BlockType): [number, number, number] => {
  if (block === BlockType.Grass) return [0.39453125, 0.2890625, 0.20703125]
  if (block === BlockType.Snow) return getTopColorByBlock(BlockType.Stone)
  return getTopColorByBlock(block)
}

const randomizeColor = (color: [number, number, number]): [number, number, number] => {
  const r = Math.random() * 0.03 - 0.015
  return [color[0]! + r, color[1]! + r, color[2]! + r]
}

interface WorldSize {
  readonly sizeX: number
  readonly sizeY: number
  readonly sizeZ: number
}

export const generateWorld = ({ sizeX, sizeY, sizeZ }: WorldSize): Uint8Array => {
  const world = new Uint8Array(sizeX * sizeY * sizeZ)
  world.fill(BlockType.Air)
  const noise = makeNoise2D(123)
  const borderSizeX = (sizeX * 0.1) | 0
  const borderSizeZ = (sizeZ * 0.1) | 0
  const borderSizeXSecond = sizeX - borderSizeX
  const borderSizeZSecond = sizeZ - borderSizeZ
  const centerX = sizeX / 2
  const centerZ = sizeZ / 2
  for (let j = 0; j < sizeZ; j++) {
    for (let k = 0; k < sizeX; k++) {
      const factor = 0.01
      let remappedNoiseValue = noise(j * factor, k * factor) * 0.5 + 0.5
      if (j < borderSizeZ) remappedNoiseValue = (j / borderSizeZ) ** (1 / 3) * remappedNoiseValue
      if (k < borderSizeX) remappedNoiseValue = (k / borderSizeX) ** (1 / 3) * remappedNoiseValue
      if (j > borderSizeZSecond)
        remappedNoiseValue = (1 - (j - borderSizeZSecond) / borderSizeZ) ** (1 / 3) * remappedNoiseValue
      if (k > borderSizeXSecond)
        remappedNoiseValue = (1 - (k - borderSizeXSecond) / borderSizeX) ** (1 / 3) * remappedNoiseValue

      const distanceToCenter = (1 - Math.sqrt(((centerX - k) / sizeX) ** 2 + ((centerZ - j) / sizeZ) ** 2)) ** 3
      let y = (remappedNoiseValue ** (2 / 3) * distanceToCenter * sizeY) | 0

      const block = getBlockTypeByNoiseValue(y / sizeY)
      world[y * sizeX * sizeZ + k * sizeZ + j] = block
      let blockToSet = BlockType.Stone

      if (block === BlockType.Water || block === BlockType.DeepWater) {
        blockToSet = block
        y = 5
      }

      for (let i = 0; i < y; i++) {
        world[i * sizeX * sizeZ + k * sizeZ + j] = blockToSet
      }
    }
  }
  return world
}
