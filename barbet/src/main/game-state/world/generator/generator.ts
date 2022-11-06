import { makeNoise2D } from '@seampan/noise/2d'
import { BiomeId } from '../biome'
import { WorldSize } from '../world'

export interface GeneratorSettings extends WorldSize {
  biomeSeed: number
  heightSeed: number
}

const getBiomeByValue = (value: number): BiomeId => {
  if (value < -0.4) return BiomeId.Snowy

  if (value < 0.3) return BiomeId.Forest

  return BiomeId.Desert
}

export const generateBiomeMap = (settings: GeneratorSettings): Uint8Array => {
  const { sizeX, sizeZ } = settings
  const data = new Uint8Array(sizeX * sizeZ)
  if (BiomeId.Void !== 0) data.fill(BiomeId.Void)

  const noise = makeNoise2D(settings.biomeSeed)
  const noise2 = makeNoise2D(settings.biomeSeed)
  const factor = 0.003
  const factor2 = 0.04
  let index = 0
  for (let z = 0; z < sizeZ; z++) {
    const zFactored = z * factor
    const zFactored2 = z * factor2
    for (let x = 0; x < sizeX; x++) {
      const value = noise(x * factor, zFactored)
      const value2 = noise2(x * factor2, zFactored2)
      data[index++] = getBiomeByValue((value * 9 + value2) / 10)
    }
  }

  return data
}

export const generateHeightMap = (settings: GeneratorSettings): Uint8Array => {
  const { sizeX, sizeY, sizeZ } = settings
  const data = new Uint8Array(sizeX * sizeZ)
  if (BiomeId.Void !== 0) data.fill(BiomeId.Void)

  // noise is for small features
  // noise2 is for mainland

  const noise = makeNoise2D(settings.heightSeed)
  const noise2 = makeNoise2D(settings.heightSeed)
  const noise3 = makeNoise2D(settings.heightSeed)
  const noise4 = makeNoise2D(settings.heightSeed)
  const noise5 = makeNoise2D(settings.heightSeed)
  const factor = 0.025
  const factor2 = 0.005
  const factor3 = 0.002
  const factor4 = 0.001
  const factor5 = 0.01

  const foo2 = (x: number): number => Math.atan(80 * (x - 0.5)) / Math.PI + 0.5
  const foo3 = (x: number): number => Math.abs(Math.atan(128 * x) / (Math.PI / 2)) ** 4
  const foo4 = (x: number): number => (Math.abs(1 / (1 + Math.E ** (-10 * (x + 1))) - 0.5) * 2) ** 5

  let index = 0
  for (let z = 0; z < sizeZ; z++) {
    const zFactored = z * factor
    const zFactored2 = z * factor2
    const zFactored3 = z * factor3
    const zFactored4 = z * factor4
    const zFactored5 = z * factor5
    for (let x = 0; x < sizeX; x++) {
      const value = (noise(x * factor, zFactored) + 1) * 0.5 ** 2
      const value2 = (noise2(x * factor2, zFactored2) + 1) * 0.5
      const value3 = foo3(noise3(x * factor3, zFactored3))
      const value4 = foo3(noise4(x * factor4, zFactored4))
      const value5 = foo4(noise5(x * factor5, zFactored5))

      const height = (((foo2(value2) * 5 + value * 2) / 7) * 0.7 + 0.3) * value3 * value4 * value5
      data[index] = (height * sizeY) | 0
      index++
    }
  }

  return data
}
