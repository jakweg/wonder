import { Mesh } from '../world/world-to-mesh-converter'
import * as monument from './monument'

export const enum BuildingId {
  None,
  Monument,
}

export interface BuildingMask {
  sizeX: number
  sizeZ: number
}

export interface BuildingMesh {
  finished: Mesh
  inProgressStates: Mesh[]
}

export interface BuildingProgressInfo {
  pointsToFullyBuild: number
}

export const getBuildingMask = (id: BuildingId): Readonly<BuildingMask> | null => {
  switch (id) {
    case BuildingId.Monument:
      return monument.getMask()
    case BuildingId.None:
    default:
      return null
  }
}

export const getBuildingProgressInfo = (id: BuildingId): Readonly<BuildingProgressInfo> | null => {
  switch (id) {
    case BuildingId.Monument:
      return monument.getProgressInfo()
    case BuildingId.None:
    default:
      return null
  }
}

export const getBuildingModel = (id: BuildingId): Readonly<BuildingMesh> | null => {
  switch (id) {
    case BuildingId.Monument:
      return monument.getModel()
    case BuildingId.None:
    default:
      return null
  }
}
