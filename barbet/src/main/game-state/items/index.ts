import GPUBuffer from '@3d/gpu-resources/buffer'
import * as box from './box'

export type MeshBuffer = { array: GPUBuffer; indices: GPUBuffer; trianglesToRender: number }

const emptyBuffer: MeshBuffer = {
  array: null as unknown as GPUBuffer,
  indices: null as unknown as GPUBuffer,
  trianglesToRender: 0,
}

export const enum ItemType {
  None,
  Box,
  SIZE,
}

export const getAppendToMeshFunction = (type: ItemType) => {
  switch (type) {
    case ItemType.None:
      return () => void 0
    case ItemType.Box:
      return box.appendToMesh
    default:
      throw new Error()
  }
}

export const getCreateMeshBuffer = (type: ItemType) => {
  switch (type) {
    case ItemType.Box:
      return box.createMeshBuffer
    case ItemType.None:
    default:
      return () => emptyBuffer
  }
}
