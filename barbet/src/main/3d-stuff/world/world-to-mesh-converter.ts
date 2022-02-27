import SeededRandom from '../../util/seeded-random'
import { AIR_ID, allBlocks, BlockId } from './block'
import { World } from './world'

const NO_ELEMENT_INDEX_MARKER = 4294967295
const NO_COLOR_VALUE = 2
const NO_FLAGS_VALUE = 0

const FLOATS_PER_VERTEX = 7

const randomizeColor = (x: number, y: number, z: number,
                        color: [number, number, number]): [number, number, number] => {
	const r = SeededRandom.singleRandom(x * 1231.1242412 + y * 42412.123141 ^ z * 911019204.09235) * 0.02 - 0.01
	color[0] += r
	color[1] += r
	color[2] += r
	return color
}

export const convertWorldToMesh = (world: World) => {
	const {sizeX, sizeY, sizeZ} = world.size
	const worldData = world.rawBlockData

	const vertexIndexes = new Uint32Array((sizeX + 1) * (sizeY + 1) * (sizeZ + 1))
	vertexIndexes.fill(NO_ELEMENT_INDEX_MARKER)
	console.assert(vertexIndexes[0] === NO_ELEMENT_INDEX_MARKER)

	const vertexes: number[] = []
	const indices: number[] = []

	let addedVertexesCounter = 0

	const vertexesPerY = (sizeX + 1) * (sizeZ + 1)

	const vertexesPerX = (sizeZ + 1)
	const forceAddVertex = (positionIndex: number, x: number, y: number, z: number): number => {
		vertexes.push(x, y, z, NO_COLOR_VALUE, NO_COLOR_VALUE, NO_COLOR_VALUE, NO_FLAGS_VALUE)
		vertexIndexes[positionIndex] = addedVertexesCounter
		return addedVertexesCounter++
	}

	const addVertexIfNotExists = (x: number, y: number, z: number): number => {
		const positionIndex = y * vertexesPerY + x * vertexesPerX + z
		const elementIndex = vertexIndexes[positionIndex]!
		if (elementIndex === NO_ELEMENT_INDEX_MARKER) {
			return forceAddVertex(positionIndex, x, y, z)
		}
		return elementIndex
	}

	const setVertexData = (vertexIndex: number,
	                       colorValue: [number, number, number],
	                       encodedNormal: number,
	                       forX: number, forY: number, forZ: number): number => {
		let vertexStartIndex = vertexIndex * FLOATS_PER_VERTEX
		const wasNeverUsed = vertexes[vertexStartIndex + 3]! === NO_COLOR_VALUE
			&& vertexes[vertexStartIndex + 4]! === NO_COLOR_VALUE
			&& vertexes[vertexStartIndex + 5]! === NO_COLOR_VALUE

		const x = vertexes[vertexStartIndex]!
		const y = vertexes[vertexStartIndex + 1]!
		const z = vertexes[vertexStartIndex + 2]!
		if (!wasNeverUsed) {
			const positionIndex = y * vertexesPerY + x * vertexesPerX + z
			vertexIndex = forceAddVertex(positionIndex, x, y, z)
			vertexStartIndex = vertexIndex * FLOATS_PER_VERTEX
		}
		vertexes[vertexStartIndex + 3] = colorValue[0]
		vertexes[vertexStartIndex + 4] = colorValue[1]
		vertexes[vertexStartIndex + 5] = colorValue[2]
		const ox = x - forX
		const oy = y - forY
		const oz = z - forZ
		if (ox < 0 || oy < 0 || oz < 0 || ox > 1 || oy > 1 || oz > 1)
			throw new Error(`Invalid offset ${ox} ${oy} ${oz}`)
		vertexes[vertexStartIndex + 6] = encodedNormal | ((ox << 4 | oy << 2 | oz) << 8)
		return vertexIndex
	}

	for (let y = 0; y < sizeY; y++) {
		for (let z = 0; z < sizeZ; z++) {
			for (let x = 0; x < sizeX; x++) {
				const thisBlockId = worldData[y * sizeX * sizeZ + x * sizeZ + z]! as BlockId
				if (thisBlockId === AIR_ID) continue

				const needsTop = y === sizeY - 1 || worldData[(y + 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockId === AIR_ID
				// const needsBottom = y === 0 || worldData[(y - 1) * sizeX * sizeZ + x * sizeZ + z]! as BlockId === AIR_ID
				const needsBottom = false // disabled temporarily
				const needsPositiveZ = z === sizeZ - 1 || worldData[y * sizeX * sizeZ + x * sizeZ + (z + 1)]! as BlockId === AIR_ID
				const needsNegativeZ = z === 0 || worldData[y * sizeX * sizeZ + x * sizeZ + (z - 1)]! as BlockId === AIR_ID
				const needsPositiveX = x === sizeX - 1 || worldData[y * sizeX * sizeZ + (x + 1) * sizeZ + z]! as BlockId === AIR_ID
				const needsNegativeX = x === 0 || worldData[y * sizeX * sizeZ + (x - 1) * sizeZ + z]! as BlockId === AIR_ID

				const needsHorizontal = needsTop || needsBottom
				const needsAnySide = needsPositiveZ || needsNegativeZ || needsPositiveX || needsNegativeX
				if (!(needsHorizontal || needsAnySide)) continue
				let e1 = 0, e2 = 0, e3 = 0, e4 = 0, e5 = 0, e6 = 0, e7 = 0, e8 = 0

				if (needsTop || needsAnySide) {
					e1 = addVertexIfNotExists(x, y + 1, z)
					e2 = addVertexIfNotExists(x, y + 1, z + 1)
					e3 = addVertexIfNotExists(x + 1, y + 1, z + 1)
					e4 = addVertexIfNotExists(x + 1, y + 1, z)
				}

				if (needsBottom || needsAnySide) {
					e5 = addVertexIfNotExists(x, y, z)
					e6 = addVertexIfNotExists(x, y, z + 1)
					e7 = addVertexIfNotExists(x + 1, y, z + 1)
					e8 = addVertexIfNotExists(x + 1, y, z)
				}

				const thisBlock = allBlocks[thisBlockId]!
				const color: [number, number, number] = [thisBlock.colorR, thisBlock.colorG, thisBlock.colorB]
				if (needsTop) {
					const topColor = randomizeColor(x, y, z, [...color])
					e1 = setVertexData(e1, topColor, 0b011001, x, y, z)
					indices.push(
						e2, e3, e1,
						e3, e4, e1,
					)
				}

				// if (needsBottom) {
				// 	e5 = setVertexData(e5, topColor, 0b010001,x,y,z)
				// 	elements.push(
				// 		e7, e6, e5,
				// 		e8, e7, e5,
				// 	)
				// }

				const sideColor = randomizeColor(x, y, z, color)
				if (needsPositiveX) {
					e7 = setVertexData(e7, sideColor, 0b100101, x, y, z)
					indices.push(
						e4, e3, e7,
						e8, e4, e7,
					)
				}

				if (needsNegativeX) {
					e2 = setVertexData(e2, sideColor, 0b000101, x, y, z)
					indices.push(
						e1, e5, e2,
						e5, e6, e2,
					)
				}

				if (needsPositiveZ) {
					e3 = setVertexData(e3, sideColor, 0b010110, x, y, z)
					indices.push(
						e2, e6, e3,
						e6, e7, e3,
					)
				}

				if (needsNegativeZ) {
					e8 = setVertexData(e8, sideColor, 0b010100, x, y, z)
					indices.push(
						e1, e4, e8,
						e5, e1, e8,
					)
				}
			}
		}
	}


	return {
		vertexes: new Float32Array(vertexes),
		indices: new Uint32Array(indices),
	}
}
