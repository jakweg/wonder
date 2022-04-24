import { ItemType } from '../items'
import * as stone from './stone'

export const enum SurfaceResourceType {
	None,
	Stone,
}

export const getGatheredItem = (surface: SurfaceResourceType): ItemType => {
	switch (surface) {
		case SurfaceResourceType.Stone:
			return stone.gatheredItem
		case SurfaceResourceType.None:
		default:
			return ItemType.None
	}
}

export const getAppendToMeshFunction = (surface: SurfaceResourceType) => {
	switch (surface) {
		case SurfaceResourceType.Stone:
			return stone.appendToMesh
		case SurfaceResourceType.None:
		default:
			return () => undefined
	}
}
