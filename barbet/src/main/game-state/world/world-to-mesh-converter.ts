import { createNewBuffer } from '@utils/shared-memory'
import { AIR_ID, allBlocks, BlockId } from './block'

const NO_ELEMENT_INDEX_MARKER = 4294967295
const NO_COLOR_VALUE = 2

const FLOATS_PER_VERTEX = 6

const enum FieldOffset {
  X,
  Y,
  Z,
  Offsets,
  R,
  G,
  B,
  Normal,
  AmbientOcclusion1,
  AmbientOcclusion2,
  SIZE,
}

const PREALLOCATE_VERTEX_COUNT = 20_000
const PREALLOCATE_INDICES_COUNT = 80_000

export interface Mesh {
  vertexes: Uint8Array
  indices: Uint16Array
}

interface WorldLike {
  size: { sizeX: number; sizeY: number; sizeZ: number }
  rawBlockData: Uint8Array
}

export const buildChunkMesh = (world: WorldLike, chunkX: number, chunkZ: number, chunkSize: number): Mesh => {
  const { sizeX, sizeY, sizeZ } = world.size
  const worldData = world.rawBlockData

  const vertexDataBuffer = createNewBuffer(PREALLOCATE_VERTEX_COUNT * FieldOffset.SIZE)
  const vertexView = new DataView(vertexDataBuffer)
  let lastVertexIndex = 0

  const vertexIndexes = new Uint32Array((chunkSize + 1) * (sizeY + 1) * (chunkSize + 1))
  vertexIndexes.fill(NO_ELEMENT_INDEX_MARKER)
  console.assert(vertexIndexes[0] === NO_ELEMENT_INDEX_MARKER)

  const vertexComputedAO: number[] = []
  const indices = new Uint16Array(createNewBuffer(PREALLOCATE_INDICES_COUNT * Uint16Array.BYTES_PER_ELEMENT))
  let lastIndicesIndex = 0

  const vertexesPerY = (chunkSize + 1) * (chunkSize + 1)

  const vertexesPerX = chunkSize + 1

  const isBlockAir = (x: number, y: number, z: number): number => {
    if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) return 1
    const thisBlockId = worldData[y * sizeX * sizeZ + x * sizeZ + z]! as BlockId
    return thisBlockId === AIR_ID ? 1 : 0
  }

  const computeAmbientOcclusion = (x: number, y: number, z: number): number => {
    const nx = x - 1
    const ny = y - 1
    const nz = z - 1
    const index =
      isBlockAir(x, y, z) +
      isBlockAir(nx, y, z) +
      isBlockAir(x, y, nz) +
      isBlockAir(nx, y, nz) +
      isBlockAir(x, ny, z) +
      isBlockAir(nx, ny, z) +
      isBlockAir(x, ny, nz) +
      isBlockAir(nx, ny, nz)

    return index!
  }

  const startX = chunkX * chunkSize
  const startZ = chunkZ * chunkSize
  const forceAddVertex = (positionIndex: number, x: number, y: number, z: number): number => {
    vertexView.setUint8(lastVertexIndex * FieldOffset.SIZE + FieldOffset.X, x - startX)
    vertexView.setUint8(lastVertexIndex * FieldOffset.SIZE + FieldOffset.Y, y)
    vertexView.setUint8(lastVertexIndex * FieldOffset.SIZE + FieldOffset.Z, z - startZ)

    vertexView.setUint8(lastVertexIndex * FieldOffset.SIZE + FieldOffset.R, NO_COLOR_VALUE)

    vertexComputedAO.push(computeAmbientOcclusion(x, y, z))
    vertexIndexes[positionIndex] = lastVertexIndex
    return lastVertexIndex++
  }

  const addVertexIfNotExists = (x: number, y: number, z: number): number => {
    const positionIndex = y * vertexesPerY + (x - startX) * vertexesPerX + (z - startZ)
    const elementIndex = vertexIndexes[positionIndex]!
    if (elementIndex === NO_ELEMENT_INDEX_MARKER) {
      return forceAddVertex(positionIndex, x, y, z)
    }
    return elementIndex
  }

  const setVertexData = (
    vertexIndex: number,
    colorValue: number,
    encodedNormal: number,
    forX: number,
    forY: number,
    forZ: number,
  ): number => {
    const wasNeverUsed = vertexView.getUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.R) === NO_COLOR_VALUE

    const x = vertexView.getUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.X)
    const y = vertexView.getUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.Y)
    const z = vertexView.getUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.Z)
    if (!wasNeverUsed) {
      const positionIndex = y * vertexesPerY + x * vertexesPerX + z
      vertexIndex = forceAddVertex(positionIndex, x + startX, y, z + startZ)
    }
    vertexView.setUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.R, (colorValue >> 16) & 0xff)
    vertexView.setUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.G, (colorValue >> 8) & 0xff)
    vertexView.setUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.B, (colorValue >> 0) & 0xff)

    const ox = x - (forX - startX)
    const oy = y - forY
    const oz = z - (forZ - startZ)
    if (ox < 0 || oy < 0 || oz < 0 || ox > 1 || oy > 1 || oz > 1) {
      console.log({ ox, oy, oz, forX, forY, forZ, startX, startZ, x, y, z, wasNeverUsed })

      throw new Error(`Invalid offset ${ox} ${oy} ${oz}`)
    }
    vertexView.setUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.Offsets, ((ox << 4) | (oy << 2) | oz) & 255)
    vertexView.setUint8(vertexIndex * FieldOffset.SIZE + FieldOffset.Normal, encodedNormal)
    return vertexIndex
  }

  for (let y = 0; y < sizeY; y++) {
    for (let z = chunkZ * chunkSize, mz = Math.min((chunkZ + 1) * chunkSize, sizeZ); z < mz; z++) {
      for (let x = chunkX * chunkSize, mx = Math.min((chunkX + 1) * chunkSize, sizeX); x < mx; x++) {
        const thisBlockId = worldData[y * sizeX * sizeZ + x * sizeZ + z]! as BlockId
        if (thisBlockId === AIR_ID) continue

        const needsTop = y === sizeY - 1 || (worldData[(y + 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockId) === AIR_ID
        // const needsBottom = y === 0 || worldData[(y - 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockId === AIR_ID
        const needsBottom = false // disabled temporarily
        const needsPositiveZ =
          z === sizeZ - 1 || (worldData[y * sizeX * sizeZ + x * sizeZ + (z + 1)]! as BlockId) === AIR_ID
        const needsNegativeZ = z === 0 || (worldData[y * sizeX * sizeZ + x * sizeZ + (z - 1)]! as BlockId) === AIR_ID
        const needsPositiveX =
          x === sizeX - 1 || (worldData[y * sizeX * sizeZ + (x + 1) * sizeZ + z]! as BlockId) === AIR_ID
        const needsNegativeX = x === 0 || (worldData[y * sizeX * sizeZ + (x - 1) * sizeZ + z]! as BlockId) === AIR_ID

        const needsHorizontal = needsTop || needsBottom
        const needsAnySide = needsPositiveZ || needsNegativeZ || needsPositiveX || needsNegativeX
        if (!(needsHorizontal || needsAnySide)) continue
        let e1 = 0,
          e2 = 0,
          e3 = 0,
          e4 = 0,
          e5 = 0,
          e6 = 0,
          e7 = 0,
          e8 = 0

        if (needsTop || needsAnySide) {
          e1 = addVertexIfNotExists(x, y + 1, z)
          e2 = addVertexIfNotExists(x, y + 1, z + 1)
          e3 = addVertexIfNotExists(x + 1, y + 1, z + 1)
          e4 = addVertexIfNotExists(x + 1, y + 1, z)
        }

        if (needsBottom || needsAnySide) {
          e5 = addVertexIfNotExists(x, y, z)
          e6 = addVertexIfNotExists(x, y, z + 1)
          e7 = addVertexIfNotExists(x + 1, y, z + 1)
          e8 = addVertexIfNotExists(x + 1, y, z)
        }

        const thisBlock = allBlocks[thisBlockId]!
        const color = thisBlock.color

        if (needsTop) {
          e1 = setVertexData(e1, color, 0b011001, x, y, z)
          indices[lastIndicesIndex++] = e2
          indices[lastIndicesIndex++] = e3
          indices[lastIndicesIndex++] = e1
          indices[lastIndicesIndex++] = e3
          indices[lastIndicesIndex++] = e4
          indices[lastIndicesIndex++] = e1
        }

        // if (needsBottom) {
        // 	e5 = setVertexData(e5, topColor, 0b010001,x,y,z)
        // 	elements.push(
        // 		e7, e6, e5,
        // 		e8, e7, e5,
        // 	)
        // }

        const sideColor = color
        if (needsPositiveX) {
          e7 = setVertexData(e7, sideColor, 0b100101, x, y, z)
          indices[lastIndicesIndex++] = e4
          indices[lastIndicesIndex++] = e3
          indices[lastIndicesIndex++] = e7
          indices[lastIndicesIndex++] = e8
          indices[lastIndicesIndex++] = e4
          indices[lastIndicesIndex++] = e7
        }

        if (needsNegativeX) {
          e2 = setVertexData(e2, sideColor, 0b000101, x, y, z)
          indices[lastIndicesIndex++] = e1
          indices[lastIndicesIndex++] = e5
          indices[lastIndicesIndex++] = e2
          indices[lastIndicesIndex++] = e5
          indices[lastIndicesIndex++] = e6
          indices[lastIndicesIndex++] = e2
        }

        if (needsPositiveZ) {
          e3 = setVertexData(e3, sideColor, 0b010110, x, y, z)
          indices[lastIndicesIndex++] = e2
          indices[lastIndicesIndex++] = e6
          indices[lastIndicesIndex++] = e3
          indices[lastIndicesIndex++] = e6
          indices[lastIndicesIndex++] = e7
          indices[lastIndicesIndex++] = e3
        }

        if (needsNegativeZ) {
          e8 = setVertexData(e8, sideColor, 0b010100, x, y, z)
          indices[lastIndicesIndex++] = e1
          indices[lastIndicesIndex++] = e4
          indices[lastIndicesIndex++] = e8
          indices[lastIndicesIndex++] = e5
          indices[lastIndicesIndex++] = e1
          indices[lastIndicesIndex++] = e8
        }
      }
    }
  }

  const extractAOFromVertex = (index: number) => vertexComputedAO[index]! & 0b1111

  const putFlatAOFromVertex = (index: number, a: number, b: number, c: number, d: number) =>
    vertexView.setUint16(
      index * FieldOffset.SIZE + FieldOffset.AmbientOcclusion1,
      ((a & 0b1111) << 8) | ((b & 0b1111) << 12) | ((c & 0b1111) << 0) | ((d & 0b1111) << 4),
    )

  const squaresCount = (indices.length / 6) | 0
  for (let i = 0; i < squaresCount; ++i) {
    const i0 = indices[i * 6 + 0]!
    const i1 = indices[i * 6 + 1]!
    const i2 = indices[i * 6 + 2]!
    const i3 = indices[i * 6 + 3]!
    const i4 = indices[i * 6 + 4]!
    const i5 = indices[i * 6 + 5]!

    if (i0 !== i4) {
      putFlatAOFromVertex(
        i2,
        extractAOFromVertex(i0),
        extractAOFromVertex(i1),
        extractAOFromVertex(i2),
        extractAOFromVertex(i4),
      )
      putFlatAOFromVertex(
        i5,
        extractAOFromVertex(i3),
        extractAOFromVertex(i4),
        extractAOFromVertex(i5),
        extractAOFromVertex(i0),
      )
    } else {
      putFlatAOFromVertex(
        i2,
        extractAOFromVertex(i0),
        extractAOFromVertex(i1),
        extractAOFromVertex(i2),
        extractAOFromVertex(i3),
      )
      putFlatAOFromVertex(
        i5,
        extractAOFromVertex(i3),
        extractAOFromVertex(i4),
        extractAOFromVertex(i5),
        extractAOFromVertex(i1),
      )
    }
  }

  const usedVertexesPercentage = lastVertexIndex / PREALLOCATE_VERTEX_COUNT
  const usedIndicesPercentage = lastIndicesIndex / PREALLOCATE_INDICES_COUNT

  if (lastVertexIndex > PREALLOCATE_VERTEX_COUNT) throw new Error(`${lastVertexIndex}`)
  if (lastIndicesIndex > PREALLOCATE_INDICES_COUNT) throw new Error(`${lastIndicesIndex}`)

  const finalVertexes =
    usedVertexesPercentage < 0.5
      ? new Uint8Array(vertexDataBuffer.slice(0, lastVertexIndex * FieldOffset.SIZE))
      : new Uint8Array(vertexDataBuffer, 0, lastVertexIndex * FieldOffset.SIZE)

  const finalIndices =
    usedIndicesPercentage < 0.5
      ? new Uint16Array(indices['buffer'].slice(0, lastIndicesIndex * Uint16Array.BYTES_PER_ELEMENT))
      : new Uint16Array(indices['buffer'], 0, lastIndicesIndex)

  return {
    vertexes: finalVertexes,
    indices: finalIndices,
  }
}

export const moveChunkMesh = (mesh: Mesh, offsetX: number, offsetY: number, offsetZ: number) => {
  const vertexes = mesh.vertexes
  const size = (vertexes.length / FLOATS_PER_VERTEX) | 0
  for (let i = 0; i < size; i++) {
    vertexes[i * FLOATS_PER_VERTEX] += offsetX
    vertexes[i * FLOATS_PER_VERTEX + 1] += offsetY
    vertexes[i * FLOATS_PER_VERTEX + 2] += offsetZ
  }
}
