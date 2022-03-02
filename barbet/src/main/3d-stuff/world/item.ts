import { freezeAndValidateOptionsList } from '../../util/common'
import boxItem from '../game-state/items/box'
import { GPUBuffer, MainRenderer } from '../main-renderer'

export const enum ItemType {
	None,
	Box,
}

export type MeshBuffer = { array: GPUBuffer, indices: GPUBuffer, trianglesToRender: number }

export interface Item {
	/** must be between 0 and 255 */
	numericId: ItemType

	appendToMesh(x: number, y: number, z: number,
	             vertexData: number[],
	             elementsData: number[]): void

	createMeshBuffer(renderer: MainRenderer): MeshBuffer
}

export const allItems: Item[] = [
	{
		numericId: ItemType.None,
		appendToMesh() {
		},
		createMeshBuffer(): MeshBuffer {
			return {array: null, indices: null, trianglesToRender: 0} as unknown as MeshBuffer
		},
	},
	boxItem,
]
export const requireItem = (id: ItemType): Item => {
	const item = allItems[id]
	if (item == null)
		throw new Error(`Invalid item id ${id}`)
	return item
}

freezeAndValidateOptionsList(allItems)
