import { MainRenderer } from '../../3d-stuff/main-renderer'
import { Item, ItemType, MeshBuffer } from '../world/item'

const rootVertexes = [
	-0.5, -0.5, -0.5, 0b010001,
	0.5, -0.5, -0.5, 0b010100,
	0.5, -0.5, 0.5, 0b100101,
	-0.5, -0.5, 0.5, 0b010110,

	-0.5, 0.5, -0.5, 0,
	0.5, 0.5, -0.5, 0b101110,
	0.5, 0.5, 0.5, 0,
	-0.5, 0.5, 0.5, 0b000101]

const vertexes: Readonly<Float32Array> = new Float32Array(rootVertexes
	.map((e, i) => {
		if (i % 4 === 3)
			return e // flags
		e += 0.5
		e *= 0.7

		if (i % 2 === 0)
			e += 0.15 // x, z

		return e
	}))

const vertexesInHand: Readonly<Float32Array> = new Float32Array(rootVertexes
	.map((e, i) => {
		if (i % 4 === 3)
			return e // flags
		e *= 0.9
		return e
	}))

const elements: Readonly<Uint8Array> = new Uint8Array([
	// bottom
	1, 2, 0,
	2, 3, 0,
	// bottom front
	0, 4, 1,
	4, 5, 1,
	// bottom right side
	1, 5, 2,
	5, 6, 2,
	// bottom left side
	0, 3, 7,
	4, 0, 7,
	// bottom back
	2, 6, 3,
	6, 7, 3,
	// top
	4, 7, 5,
	7, 6, 5,
])

const boxItem: Item = {
	numericId: ItemType.Box,
	appendToMesh(x: number, y: number, z: number,
	             vertexData: number[],
	             elementsData: number[]) {
		const vertexCountBeforeAdd = vertexData.length / 4 | 0
		for (let i = 0, s = vertexes.length; i < s;) {
			const vx = vertexes[i++]! + x
			const vy = vertexes[i++]! + y
			const vz = vertexes[i++]! + z
			const flags = vertexes[i++]!
			vertexData.push(vx, vy, vz, flags)
		}

		for (const index of elements) {
			elementsData.push(index + vertexCountBeforeAdd)
		}
	},
	createMeshBuffer(renderer: MainRenderer): MeshBuffer {
		const array = renderer.createBuffer(true, false)
		array.setContent(vertexesInHand)
		const indices = renderer.createBuffer(false, false)
		indices.setContent(elements)
		return {array, indices, trianglesToRender: elements.length | 0}
	},
}

export default boxItem
