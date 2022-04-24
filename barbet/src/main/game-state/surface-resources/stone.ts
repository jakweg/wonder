import { calculateNormals } from '../../3d-stuff/common-shader'
import { lazy } from '../../util/lazy'
import { ItemType } from '../items'

const createVertexesAndElements = (size: number, scale: number) => {
	if (size !== (size | 0) || size < 3 || size > 100)
		throw new Error('Invalid size')

	const vertexData = new Float32Array((size + 1) * 6)
	const elementsData = new Uint8Array(size * 3)

	vertexData[0] = 0.5
	vertexData[1] = scale * 0.9
	vertexData[2] = 0.5

	const initialAngle = Math.PI / 4
	const r = scale * 0.5
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

const vertexesAndElements = /* @__PURE__ */ lazy(() => {
	const tmp = createVertexesAndElements(6, 0.7)
	calculateNormals(tmp.elementsData, tmp.vertexData, 6, 3)
	return tmp
})

function extracted(vertexDataToAppend: number[], elementsDataToAppend: number[],
                   x: number, y: number, z: number,
                   scale: number) {
	const vertexCountBeforeAdd = vertexDataToAppend.length / 6 | 0
	const vertexes = vertexesAndElements().vertexData
	for (let i = 0, s = vertexes.length; i < s;) {
		const vx = vertexes[i++]! * scale + x
		const vy = vertexes[i++]! * scale + y
		const vz = vertexes[i++]! * scale + z
		vertexDataToAppend.push(vx, vy, vz,
			vertexes[i++]!,
			vertexes[i++]!,
			vertexes[i++]!)
	}

	const elementsData = vertexesAndElements().elementsData
	for (const index of elementsData) {
		elementsDataToAppend.push(index + vertexCountBeforeAdd)
	}
}

export const appendToMesh = (x: number, y: number, z: number,
                             amount: number,
                             vertexDataToAppend: number[],
                             elementsDataToAppend: number[]): void => {
	if (amount > 0)
		extracted(vertexDataToAppend, elementsDataToAppend, x, y, z, 1)
	if (amount > 1)
		extracted(vertexDataToAppend, elementsDataToAppend, x - 0.1, y, z + 0.5, 0.5)
	if (amount > 2)
		extracted(vertexDataToAppend, elementsDataToAppend, x + 0.1, y, z, 0.4)
	if (amount > 3)
		extracted(vertexDataToAppend, elementsDataToAppend, x - 0.1, y, z, 0.3)
	if (amount > 4)
		extracted(vertexDataToAppend, elementsDataToAppend, x + 0.5, y, z + 0.4, 0.6)
}

export const gatheredItem = ItemType.Box
