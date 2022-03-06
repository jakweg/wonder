import { freezeAndValidateOptionsList } from '../../util/common'
import stone from '../game-state/resources/stone'
import { ItemType } from './item'

export const enum SurfaceResourceType {
	None,
	Stone,
}

export interface SurfaceResource {
	/** must be between 0 and 255 */
	numericId: SurfaceResourceType

	gatheredItem: ItemType

	appendToMesh(x: number, y: number, z: number,
	             vertexData: number[],
	             elementsData: number[]): void
}

const allSurfaceResources: SurfaceResource[] = [
	{
		numericId: SurfaceResourceType.None,
		gatheredItem: ItemType.None,
		appendToMesh() {
		},
	},
	stone,
]

freezeAndValidateOptionsList(allSurfaceResources)

export const requireResource = (id: SurfaceResourceType): SurfaceResource => {
	const resource = allSurfaceResources[id]
	if (resource == null)
		throw new Error(`Invalid surface resource id ${id}`)
	return resource
}
