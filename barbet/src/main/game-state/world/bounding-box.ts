import { BlockId } from './block'
import { World } from './world'

export interface BoundingBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function findMinX(rawBlockData: Uint8Array, sizeZ: number, boundingBox: BoundingBox): void {
  for (let x = boundingBox.minX; x < boundingBox.maxX; x++)
    for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++) {
      const id = rawBlockData[x * sizeZ + z] as BlockId
      if (id !== BlockId.Air) {
        boundingBox.minX = x
        return
      }
    }
}

function findMaxX(rawBlockData: Uint8Array, sizeZ: number, boundingBox: BoundingBox): void {
  for (let x = boundingBox.maxX - 1; x >= boundingBox.minX; x--)
    for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++) {
      const id = rawBlockData[x * sizeZ + z] as BlockId
      if (id !== BlockId.Air) {
        boundingBox.maxX = x
        return
      }
    }
}

function findMinZ(rawBlockData: Uint8Array, sizeZ: number, boundingBox: BoundingBox): void {
  for (let z = boundingBox.minZ; z < boundingBox.maxZ; z++)
    for (let x = boundingBox.minX; x < boundingBox.maxX; x++) {
      const id = rawBlockData[x * sizeZ + z] as BlockId
      if (id !== BlockId.Air) {
        boundingBox.minZ = z
        return
      }
    }
}

function findMaxZ(rawBlockData: Uint8Array, sizeZ: number, boundingBox: BoundingBox): void {
  for (let z = boundingBox.maxZ - 1; z >= boundingBox.minZ; z--)
    for (let x = boundingBox.minX; x < boundingBox.maxX; x++) {
      const id = rawBlockData[x * sizeZ + z] as BlockId
      if (id !== BlockId.Air) {
        boundingBox.maxZ = z
        return
      }
    }
}

export const computeWorldBoundingBox = (of: World): BoundingBox => {
  throw new Error('not supported since using rawBlockData')
  // const sizeX = of.sizeLevel * GENERIC_CHUNK_SIZE
  // const sizeZ = of.sizeLevel * GENERIC_CHUNK_SIZE
  // let rawBlockData = of.rawBlockData

  // const boundingBox: BoundingBox = {
  //   minX: 0,
  //   maxX: sizeX,
  //   minZ: 0,
  //   maxZ: sizeZ,
  // }

  // findMinX(rawBlockData, sizeZ, boundingBox)
  // findMaxX(rawBlockData, sizeZ, boundingBox)
  // findMinZ(rawBlockData, sizeZ, boundingBox)
  // findMaxZ(rawBlockData, sizeZ, boundingBox)

  // return boundingBox
}
