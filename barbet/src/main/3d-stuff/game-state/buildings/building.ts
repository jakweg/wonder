import { freezeAndValidateOptionsList } from '../../../util/common'
import { ArrayEncodingType, setArrayEncodingType } from '../../../util/persistance/serializers'
import { World } from '../../world/world'
import { buildChunkMesh, Mesh } from '../../world/world-to-mesh-converter'

export const enum BuildingId {
	None,
	Monument,
}

export interface BuildingType {
	/** must be between 0 and 255 */
	readonly numericId: BuildingId

	readonly maskSizeX: number
	readonly maskSizeY: number

	readonly mask: Uint8Array

	readonly vertexes: Float32Array
	readonly indices: Uint32Array
}

const decodeVertexesAndIndices = (data: any): Mesh => {
	setArrayEncodingType(ArrayEncodingType.ToString)
	const world = World.deserialize(data)
	setArrayEncodingType(ArrayEncodingType.None)
	const chunkSize = Math.max(world.size.sizeX, world.size.sizeZ)
	return buildChunkMesh(world, 0, 0, chunkSize)
}

export const allBuilding: BuildingType[] = [
	{
		numericId: BuildingId.None,
		maskSizeX: 0,
		maskSizeY: 0,
		mask: new Uint8Array(),
		vertexes: new Float32Array(),
		indices: new Uint32Array(),
	},
	{
		numericId: BuildingId.Monument,
		maskSizeX: 5,
		maskSizeY: 5,
		mask: new Uint8Array(5 * 5).fill(1),
		...decodeVertexesAndIndices({
			'sizes': [3, 3, 3],
			'blocks': 'BwcHBwMHBwcHAAAAAAcAAAAAAAAAAAcAAAAA',
		}),
	},
]


freezeAndValidateOptionsList(allBuilding)

export const requireBuilding = (id: BuildingId): BuildingType => {
	const element = allBuilding[id]
	if (element == null)
		throw new Error(`Invalid activity id ${id}`)
	return element
}

