import { calculateNormals } from '../../shader/common'
import { ItemType } from '../../world/item'
import { SurfaceResourceType } from '../../world/surface-resource'

const createVertexesAndElements = (size: number) => {
	if (size !== (size | 0) || size < 3 || size > 100)
		throw new Error('Invalid size')

	const vertexData = new Float32Array((size + 1) * 6)
	const elementsData = new Uint8Array(size * 3)

	vertexData[0] = 0.5
	vertexData[1] = 0.75
	vertexData[2] = 0.5

	const initialAngle = Math.PI / 4
	const r = .55
	for (let i = 1; i <= size; i++) {
		const x = Math.cos(i / size * 2 * Math.PI + initialAngle) * r
		const y = Math.sin(i / size * 2 * Math.PI + initialAngle) * r

		vertexData[i * 6] = x + 0.5
		vertexData[i * 6 + 1] = 0
		vertexData[i * 6 + 2] = y + 0.5

		elementsData[(i - 1) * 3] = i
		elementsData[(i - 1) * 3 + 1] = 0
		elementsData[(i - 1) * 3 + 2] = i % size + 1
	}

	return {vertexData, elementsData}
}

const {vertexData, elementsData} = createVertexesAndElements(6)

let initialized = false
const initData = () => {
	if (initialized) return
	initialized = true
	calculateNormals(elementsData, vertexData, 6, 3)
	console.log({vertexData, elementsData})
}

export default {
	numericId: SurfaceResourceType.Stone,
	gatheredItem: ItemType.Box,

	appendToMesh(x: number, y: number, z: number,
	             vertexDataToAppend: number[],
	             elementsDataToAppend: number[]): void {
		initData()

		const vertexCountBeforeAdd = vertexDataToAppend.length / 6 | 0
		const vertexes = vertexData
		for (let i = 0, s = vertexes.length; i < s;) {
			const vx = vertexes[i++]! + x
			const vy = vertexes[i++]! + y
			const vz = vertexes[i++]! + z
			vertexDataToAppend.push(vx, vy, vz,
				vertexes[i++]!,
				vertexes[i++]!,
				vertexes[i++]!)
		}

		for (const index of elementsData) {
			elementsDataToAppend.push(index + vertexCountBeforeAdd)
		}
	},
}
