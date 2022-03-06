import { ItemType } from '../../world/item'
import { SurfaceResourceType } from '../../world/surface-resource'

const rootVertexes = new Float32Array([
	0, 0.7, 0, 0, 0, 0,
	-0.5, 0, -0.5, 0, 0, 0,
	-0.5, 0, 0.5, 0, 0, 0,
	0.5, 0, 0.5, 0, 0, 0,
	0.5, 0, -0.5, 0, 0, 0,
])

const elements: Readonly<Uint8Array> = new Uint8Array([
	2, 0, 1,
	3, 0, 2,
	4, 0, 3,
	1, 0, 4,
])

let initialized = false
const initData = () => {
	if (initialized) return
	initialized = true
	for (let i = 0, l = elements.length; i < l;) {
		const a = elements[i++]!
		const b = elements[i++]!
		const c = elements[i++]!

		const VERTEX_SIZE = 6

		const aIndex = a * VERTEX_SIZE
		const ax = rootVertexes[aIndex]!
		const ay = rootVertexes[aIndex + 1]!
		const az = rootVertexes[aIndex + 2]!

		const bIndex = b * VERTEX_SIZE
		const bx = rootVertexes[bIndex]!
		const by = rootVertexes[bIndex + 1]!
		const bz = rootVertexes[bIndex + 2]!

		const cIndex = c * VERTEX_SIZE
		// const cx = rootVertexes[cIndex]!
		// const cy = rootVertexes[cIndex + 1]!
		// const cz = rootVertexes[cIndex + 2]!

		const nx = ay * bz - az * by
		const ny = az * bx - ax * bz
		const nz = ax * by - ay * bx

		rootVertexes[cIndex + 3] = nx
		rootVertexes[cIndex + 4] = ny
		rootVertexes[cIndex + 5] = nz
	}
	for (let i = 0, l = rootVertexes.length; i < l; i += 6) {
		rootVertexes[i] = rootVertexes[i]! + 0.5
		rootVertexes[i + 2] = rootVertexes[i + 2]! + 0.5
	}
}

export default {
	numericId: SurfaceResourceType.Stone,
	gatheredItem: ItemType.Box,

	appendToMesh(x: number, y: number, z: number,
	             vertexData: number[],
	             elementsData: number[]): void {
		initData()

		const vertexCountBeforeAdd = vertexData.length / 4 | 0
		const vertexes = rootVertexes
		for (let i = 0, s = vertexes.length; i < s;) {
			const vx = vertexes[i++]! + x
			const vy = vertexes[i++]! + y
			const vz = vertexes[i++]! + z
			vertexData.push(vx, vy, vz,
				vertexes[i++]!,
				vertexes[i++]!,
				vertexes[i++]!)
		}

		for (const index of elements) {
			elementsData.push(index + vertexCountBeforeAdd)
		}
	},
}
