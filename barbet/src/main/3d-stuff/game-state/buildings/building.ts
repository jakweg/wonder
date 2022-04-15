import { freezeAndValidateOptionsList } from '../../../util/common'
import { ArrayEncodingType, setArrayEncodingType } from '../../../util/persistance/serializers'
import { AIR_ID } from '../../world/block'
import { World } from '../../world/world'
import { buildChunkMesh, Mesh, moveChunkMesh } from '../../world/world-to-mesh-converter'

export const enum BuildingId {
	None,
	Monument,
}

export interface BuildingType {
	/** must be between 0 and 255 */
	readonly numericId: BuildingId

	readonly pointsToFullyBuild: number
	readonly inProgressStates: Mesh[]

	readonly maskSizeX: number
	readonly maskSizeZ: number

	readonly mask: Uint8Array

	readonly vertexes: Float32Array
	readonly indices: Uint32Array
}

const decodeVertexesAndIndices = (data: any): {
	readonly vertexes: Float32Array
	readonly indices: Uint32Array
	readonly inProgressStates: Mesh[]
} => {
	setArrayEncodingType(ArrayEncodingType.String)
	const world = World.deserialize(data)
	setArrayEncodingType(ArrayEncodingType.None)
	const chunkSize = Math.max(world.size.sizeX, world.size.sizeZ)
	const mesh = buildChunkMesh(world, 0, 0, chunkSize)
	const offset = 0.001
	moveChunkMesh(mesh, -world.size.sizeX / 2 + offset + 0.5, offset, -world.size.sizeZ / 2 + offset + 0.5)

	const inProgressStates = countSolidBlocksInWorld(world)
	return {
		...mesh,
		inProgressStates: [...new Array(inProgressStates)].map((_, p) => createWorldMeshLimitSolidBlocks(world, p)).reverse(),
	}
}

const countSolidBlocksInWorld = (world: World): number => {
	let count = 0
	for (const blockId of world.rawBlockData) {
		if (blockId !== AIR_ID)
			count++
	}
	return count
}

const createWorldMeshLimitSolidBlocks = (world: World, count: number): Mesh => {
	const rawBlockData = new Uint8Array(world.rawBlockData)
	for (let i = 0, l = rawBlockData.length; i < l; i++) {
		if (rawBlockData[i] !== AIR_ID) {
			count--
			if (count < 0) {
				rawBlockData.fill(AIR_ID, i)
				break
			}
		}
	}
	const mesh = buildChunkMesh({rawBlockData, size: world.size}, 0, 0, Math.max(world.size.sizeX, world.size.sizeZ))
	const offset = 0.001
	moveChunkMesh(mesh, -world.size.sizeX / 2 + offset + 0.5, offset, -world.size.sizeZ / 2 + offset + 0.5)
	return mesh
}

export const allBuilding: BuildingType[] = [
	{
		numericId: BuildingId.None,
		maskSizeX: 0,
		maskSizeZ: 0,
		pointsToFullyBuild: 0,
		inProgressStates: [],
		mask: new Uint8Array(),
		vertexes: new Float32Array(),
		indices: new Uint32Array(),
	},
	{
		numericId: BuildingId.Monument,
		pointsToFullyBuild: 11,
		maskSizeX: 3,
		maskSizeZ: 3,
		mask: new Uint8Array(3 * 3).fill(1),
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

